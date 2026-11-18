// Типы повторяют Pydantic-схемы бэкенда (src/schemas.py)

export type Gender = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Goal = "bulking" | "maintenance" | "cutting";

export interface User {
  id: number;
  username: string;
  email: string;
  weight: number | null;
  height: number | null;
  gender: Gender | null;
  birth_date: string | null;
  activity_level: ActivityLevel | null;
  current_goal: Goal | null;
  created_at: string;
}

export type ProfileUpdate = Partial<Pick<User, "weight" | "height" | "gender" | "birth_date" | "activity_level" | "current_goal">>;

export interface Targets {
  target_calories: number;
  target_protein_g: number;
  target_fat_g: number;
  target_carbs_g: number;
  target_sleep_min_hours: number;
  target_sleep_max_hours: number;
  target_goal: Goal;
}

export interface Workout {
  id: number;
  user_id: number;
  workout_name: string;
  reps: number;
  sets: number;
  to_failure: boolean;
  workout_time: number;
  time_between_sets: number;
  /** кг; null — упражнение с собственным весом */
  weight_kg: number | null;
  date: string;
}
export type WorkoutInput = Omit<Workout, "id" | "user_id" | "date">;

export interface Meal {
  id: number;
  user_id: number;
  meal_name: string;
  calories: number;
  protein: number;
  fats: number;
  carbs: number;
  date: string;
}
export type MealInput = Omit<Meal, "id" | "user_id" | "date">;

export interface SleepRecord {
  id: number;
  user_id: number;
  hours_of_sleep: number;
  go_to_bed_at: string;
  wake_up_at: string;
  sleep_at_day: boolean;
  nap_hours_before_bed: number;
  hours_since_last_meal: number;
  date: string;
}
export type SleepInput = Omit<SleepRecord, "id" | "user_id" | "date" | "hours_of_sleep">;

export interface Summary {
  workouts_this_week: number;
  avg_calories_per_day: number;
  avg_hours_of_sleep: number;
}

export interface DailyStat {
  day: string;
  calories: number;
  protein: number;
  workouts: number;
  sleep_hours: number | null;
}

export interface ExerciseProgress {
  exercise: string;
  records: number;
  best_weight: number | null;
  first_weight: number | null;
  last_weight: number | null;
  last_date: string;
}

export interface Recommendation {
  category: "sleep" | "nutrition" | "workout";
  text: string;
}
