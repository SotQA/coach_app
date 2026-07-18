import { useCallback, useEffect, useMemo, useState } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { studentService } from "@/services/studentService";
import { workoutService } from "@/services/workoutService";
import { trainingGroupService } from "@/services/trainingGroupService";
import type { WorkoutLog } from "@/types/Workout";
import type { StudentSummary } from "@/types/StudentSummary";
import type { TrainingGroup } from "@/types/TrainingGroup";
import {
  buildRosterEntry,
  computeRosterSummary,
  sortByAttentionDesc,
  topByMetric,
  prCountInPeriod,
  type RosterEntry,
  type RosterSummary,
} from "@/utils/rosterAggregates";
import { logger } from "@/utils/logger";

const PERIOD_MS = 28 * 24 * 60 * 60 * 1000;
const DEFAULT_WEEKLY_TARGET = 3;

type LeaderboardMetric = "streak" | "prsInPeriod" | "sessionsInPeriod";

export interface UseCoachProgressResult {
  loading: boolean;
  error: Error | null;
  refreshing: boolean;
  onRefresh: () => void;

  summary: RosterSummary;
  totalPRsInPeriod: number;
  totalPRsDeltaPct: number | null;

  awaitingFeedback: WorkoutLog[];

  attentionList: RosterEntry[];

  leaderboardMetric: LeaderboardMetric;
  setLeaderboardMetric: (m: LeaderboardMetric) => void;
  leaderboardTop: RosterEntry[];

  hasRoster: boolean;
}

interface FetchResult {
  students: StudentSummary[];
  recentLogs: WorkoutLog[];
  awaitingFeedback: WorkoutLog[];
  trainingGroups: TrainingGroup[];
}

const EMPTY_SUMMARY: RosterSummary = { total: 0, activeLast14d: 0, onTrackThisWeek: 0, percentOnTrack: 0 };

export function useCoachProgress(coachId: string | null | undefined): UseCoachProgressResult {
  const [leaderboardMetric, setLeaderboardMetric] = useState<LeaderboardMetric>("streak");
  const [refreshing, setRefreshing] = useState(false);

  const fetcher = useCallback(async (): Promise<FetchResult> => {
    if (!coachId) throw new Error("No coach ID");

    const sinceMs = Date.now() - PERIOD_MS;
    const [studentsResult, recentLogsResult, awaitingResult, groupsResult] = await Promise.allSettled([
      studentService.getStudentsForCoach(coachId),
      workoutService.getLogsForCoachRecent(coachId, sinceMs),
      workoutService.getLogsAwaitingFeedback(coachId, 20),
      trainingGroupService.getAllGroupsForCoach(coachId),
    ]);

    const students = studentsResult.status === "fulfilled" ? studentsResult.value : [];
    const recentLogs = recentLogsResult.status === "fulfilled" ? recentLogsResult.value : [];
    const awaitingFeedback = awaitingResult.status === "fulfilled" ? awaitingResult.value : [];
    const trainingGroups = groupsResult.status === "fulfilled" ? groupsResult.value : [];

    if (studentsResult.status === "rejected") logger.warn("[useCoachProgress] students fetch failed", studentsResult.reason);
    if (recentLogsResult.status === "rejected") logger.warn("[useCoachProgress] recentLogs fetch failed", recentLogsResult.reason);
    if (awaitingResult.status === "rejected") logger.warn("[useCoachProgress] awaiting fetch failed", awaitingResult.reason);
    if (groupsResult.status === "rejected") logger.warn("[useCoachProgress] groups fetch failed", groupsResult.reason);

    return { students, recentLogs, awaitingFeedback, trainingGroups };
  }, [coachId]);

  const { data, loading, error, reload } = useAsyncData<FetchResult>(fetcher, [fetcher]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    reload();
  }, [reload]);

  useEffect(() => {
    if (!loading && refreshing) setRefreshing(false);
  }, [loading, refreshing]);

  const students = useMemo(() => data?.students ?? [], [data]);
  const recentLogs = useMemo(() => data?.recentLogs ?? [], [data]);
  const awaitingFeedback = useMemo(() => data?.awaitingFeedback ?? [], [data]);
  const trainingGroups = useMemo(() => data?.trainingGroups ?? [], [data]);

  // Build weeklyTarget per student from the latest group (groups are sorted desc by updatedAt)
  const weeklyTargetByStudent = useMemo(() => {
    const map = new Map<string, number>();
    for (const group of trainingGroups) {
      if (!map.has(group.studentId) && group.workoutsPerWeek > 0) {
        map.set(group.studentId, group.workoutsPerWeek);
      }
    }
    return map;
  }, [trainingGroups]);

  const rosterEntries = useMemo(() => {
    const now = Date.now();
    const entries = students.map((student) => {
      const theirLogs = recentLogs.filter((l) => l.studentId === student.id);
      const target = weeklyTargetByStudent.get(student.id) ?? DEFAULT_WEEKLY_TARGET;
      return buildRosterEntry(student, theirLogs, target, now);
    });
    const prMap = prCountInPeriod(entries, recentLogs);
    return entries.map((e) => ({ ...e, prsInPeriod: prMap.get(e.student.id) ?? 0 }));
  }, [students, recentLogs, weeklyTargetByStudent]);

  const summary = useMemo(() => computeRosterSummary(rosterEntries), [rosterEntries]);

  const totalPRsInPeriod = useMemo(
    () => rosterEntries.reduce((sum, e) => sum + (e.prsInPeriod ?? 0), 0),
    [rosterEntries],
  );

  const attentionList = useMemo(() => sortByAttentionDesc(rosterEntries), [rosterEntries]);

  const leaderboardTop = useMemo(
    () => topByMetric(rosterEntries, leaderboardMetric, 5),
    [rosterEntries, leaderboardMetric],
  );

  return {
    loading,
    error,
    refreshing,
    onRefresh,
    summary,
    totalPRsInPeriod,
    totalPRsDeltaPct: null,
    awaitingFeedback,
    attentionList,
    leaderboardMetric,
    setLeaderboardMetric,
    leaderboardTop,
    hasRoster: students.length > 0,
  };
}
