import { UIService } from 'src/app/shared/ui.service';
import { AngularFirestore } from '@angular/fire/firestore';
import { Subject, Subscription } from 'rxjs';
import { Exercise } from "./exercise.model";
import { Injectable } from "@angular/core";
import { map } from 'rxjs/operators';

@Injectable()
export class TrainingService {
    exerciseChanged = new Subject<Exercise>();
    exercisesChanged = new Subject<Exercise[]>();
    finishedExercisesChanged = new Subject<Exercise[]>();

    private availableExercises: Exercise[] = [];
    private runningExercise: Exercise;
    private fbSubs: Subscription[] = []

    constructor(
        private db: AngularFirestore,
        private uiService: UIService) { }

    fetchAvailableExercises() {
        this.uiService.loadingStateChanged.next(true);

        this.fbSubs.push(this.db.collection('availableExercises').snapshotChanges().
            pipe(map(docArray => {
                return docArray.map(doc => {
                    return {
                        id: doc.payload.doc.id,
                        name: doc.payload.doc.data()['name'],
                        duration: doc.payload.doc.data()['duration'],
                        calories: doc.payload.doc.data()['calories']
                    };
                })
            }))
            .subscribe((exercises: Exercise[]) => {
                this.uiService.loadingStateChanged.next(false);
                this.availableExercises = exercises;
                this.exercisesChanged.next([...this.availableExercises]);
            }, _ => {
                this.uiService.loadingStateChanged.next(false);
                this.uiService.showSnackbar('Fetching Exercises failed, try it later.', null, 3000);
                this.exercisesChanged.next(null);
            }));
    }

    getRunningExercise() {
        return { ...this.runningExercise };
    }

    fetchCompletedOrCancelledExercises() {
        this.fbSubs.push(this.db.collection('finishedExercises').valueChanges()
            .subscribe((exercises: Exercise[]) => {
                this.finishedExercisesChanged.next(exercises);
            }));
    }

    startExercise(selectedId: string) {
        //this.db.doc('availableExercises/' + selectedId).update({ lastSelected: new Date() })
        this.runningExercise = this.availableExercises.find(e => e.id === selectedId);
        this.exerciseChanged.next({ ...this.runningExercise });
    }

    completeExercise() {
        this.addDataToDatabase({
            ...this.runningExercise,
            date: new Date(),
            state: 'completed'
        });

        this.runningExercise = null;
        this.exerciseChanged.next(null);
    }

    cancelExercise(progress: number) {
        this.addDataToDatabase({
            ...this.runningExercise,
            duration: this.runningExercise.duration * (progress / 100),
            calories: this.runningExercise.calories * (progress / 100),
            date: new Date(),
            state: 'cancelled'
        });

        this.runningExercise = null;
        this.exerciseChanged.next(null);
    }

    cancelSubscriptions() {
        this.fbSubs.forEach(sub => sub.unsubscribe());
    }

    private addDataToDatabase(exercise: Exercise) {
        this.db.collection('finishedExercises').add(exercise);
    }
}