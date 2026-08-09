import { useCallback, useEffect, useMemo, useState } from "react";

import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Linking,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";

import axios from "axios";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { SafeAreaView } from "react-native-safe-area-context";

import api from "../services/api";

type JobStatus = "Applied" | "Interview" | "Offer" | "Rejected";

interface User {
  id: string;
  name: string;
  email: string;
}

interface Job {
  _id: string;
  company: string;
  position: string;
  status: JobStatus;
  location?: string;
  appliedDate?: string;
  jobUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface ApiError {
  message: string;
}

const statuses: JobStatus[] = ["Applied", "Interview", "Offer", "Rejected"];

const getTodayDate = () => {
  return new Date().toISOString().split("T")[0];
};

const formatInputDate = (date?: string) => {
  if (!date) return getTodayDate();

  return new Date(date).toISOString().split("T")[0];
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError<ApiError>(error)) {
    return error.response?.data?.message || fallback;
  }

  return fallback;
};

export default function DashboardScreen() {
  /*
   * MAIN DATA
   */

  const [user, setUser] = useState<User | null>(null);

  const [jobs, setJobs] = useState<Job[]>([]);

  const [initialLoading, setInitialLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  /*
   * SEARCH / FILTER
   */

  const [search, setSearch] = useState("");

  const [filterStatus, setFilterStatus] = useState<"" | JobStatus>("");

  /*
   * ADD / EDIT MODAL
   */

  const [applicationModalVisible, setApplicationModalVisible] = useState(false);

  const [editingJob, setEditingJob] = useState<Job | null>(null);

  const [company, setCompany] = useState("");

  const [position, setPosition] = useState("");

  const [location, setLocation] = useState("");

  const [status, setStatus] = useState<JobStatus>("Applied");

  const [appliedDate, setAppliedDate] = useState(getTodayDate());

  const [jobUrl, setJobUrl] = useState("");

  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);

  /*
   * DELETE MODAL
   */

  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);

  const [deleting, setDeleting] = useState(false);

  /*
   * LOGOUT / 401
   */

  const handleUnauthorized = useCallback(async () => {
    await SecureStore.deleteItemAsync("token");

    Alert.alert("Session expired", "Please sign in again.");

    router.replace("/");
  }, []);

  /*
   * LOAD DASHBOARD
   */

  const loadDashboard = useCallback(
    async (showLoader = true) => {
      if (showLoader) {
        setInitialLoading(true);
      }

      try {
        const jobsResponse = await api.get("/api/jobs");

        setJobs(jobsResponse.data);
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          await handleUnauthorized();
          return;
        }

        Alert.alert(
          "Error",
          getErrorMessage(error, "Unable to load applications."),
        );
      }

      try {
        const userResponse = await api.get("/api/auth/me");

        setUser(userResponse.data.user);
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          await handleUnauthorized();
          return;
        }

        Alert.alert(
          "Profile error",
          getErrorMessage(error, "Unable to load profile."),
        );
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [handleUnauthorized],
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  /*
   * PULL TO REFRESH
   */

  const refreshDashboard = async () => {
    setRefreshing(true);

    await loadDashboard(false);
  };

  /*
   * FILTERED JOBS
   */

  const filteredJobs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return jobs.filter((job) => {
      const matchesSearch =
        !query ||
        job.company.toLowerCase().includes(query) ||
        job.position.toLowerCase().includes(query) ||
        job.location?.toLowerCase().includes(query) ||
        job.notes?.toLowerCase().includes(query);

      const matchesStatus = !filterStatus || job.status === filterStatus;

      return matchesSearch && matchesStatus;
    });
  }, [jobs, search, filterStatus]);

  /*
   * STATS
   */

  const stats = useMemo(
    () => ({
      total: jobs.length,

      applied: jobs.filter((job) => job.status === "Applied").length,

      interview: jobs.filter((job) => job.status === "Interview").length,

      offer: jobs.filter((job) => job.status === "Offer").length,

      rejected: jobs.filter((job) => job.status === "Rejected").length,
    }),
    [jobs],
  );

  /*
   * RESET FORM
   */

  const resetForm = () => {
    setCompany("");
    setPosition("");
    setLocation("");
    setStatus("Applied");

    setAppliedDate(getTodayDate());

    setJobUrl("");
    setNotes("");
    setEditingJob(null);
  };

  /*
   * OPEN ADD MODAL
   */

  const openAddModal = () => {
    resetForm();

    setApplicationModalVisible(true);
  };

  /*
   * OPEN EDIT MODAL
   */

  const openEditModal = (job: Job) => {
    setEditingJob(job);

    setCompany(job.company);

    setPosition(job.position);

    setLocation(job.location || "");

    setStatus(job.status);

    setAppliedDate(formatInputDate(job.appliedDate));

    setJobUrl(job.jobUrl || "");

    setNotes(job.notes || "");

    setApplicationModalVisible(true);
  };

  /*
   * CLOSE MODAL
   */

  const closeApplicationModal = () => {
    if (saving) return;

    setApplicationModalVisible(false);

    resetForm();
  };

  /*
   * SAVE ADD / EDIT
   */

  const saveApplication = async () => {
    if (!company.trim() || !position.trim()) {
      Alert.alert("Missing information", "Company and position are required.");

      return;
    }

    if (appliedDate && !/^\d{4}-\d{2}-\d{2}$/.test(appliedDate)) {
      Alert.alert("Invalid date", "Use date format YYYY-MM-DD.");

      return;
    }

    try {
      setSaving(true);

      const data = {
        company: company.trim(),

        position: position.trim(),

        location: location.trim(),

        status,

        appliedDate,

        jobUrl: jobUrl.trim(),

        notes: notes.trim(),
      };

      /*
       * EDIT
       */

      if (editingJob) {
        const response = await api.put(`/api/jobs/${editingJob._id}`, data);

        setJobs((currentJobs) =>
          currentJobs.map((job) =>
            job._id === editingJob._id ? response.data.job : job,
          ),
        );

        setApplicationModalVisible(false);

        resetForm();

        Alert.alert("Updated", "Application updated successfully.");

        return;
      }

      /*
       * CREATE
       */

      const response = await api.post("/api/jobs", data);

      setJobs((currentJobs) => [response.data.job, ...currentJobs]);

      setApplicationModalVisible(false);

      resetForm();

      Alert.alert("Added", "Application added successfully.");
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        await handleUnauthorized();
        return;
      }

      Alert.alert(
        "Error",
        getErrorMessage(
          error,
          editingJob
            ? "Unable to update application."
            : "Unable to add application.",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  /*
   * QUICK STATUS UPDATE
   */

  const updateStatus = async (job: Job, newStatus: JobStatus) => {
    if (job.status === newStatus) {
      return;
    }

    const oldStatus = job.status;

    /*
     * INSTANT UI UPDATE
     */

    setJobs((currentJobs) =>
      currentJobs.map((item) =>
        item._id === job._id
          ? {
              ...item,
              status: newStatus,
            }
          : item,
      ),
    );

    try {
      const response = await api.put(`/api/jobs/${job._id}`, {
        company: job.company,

        position: job.position,

        location: job.location || "",

        status: newStatus,

        appliedDate: job.appliedDate,

        jobUrl: job.jobUrl || "",

        notes: job.notes || "",
      });

      setJobs((currentJobs) =>
        currentJobs.map((item) =>
          item._id === job._id ? response.data.job : item,
        ),
      );
    } catch (error) {
      /*
       * ROLLBACK
       */

      setJobs((currentJobs) =>
        currentJobs.map((item) =>
          item._id === job._id
            ? {
                ...item,
                status: oldStatus,
              }
            : item,
        ),
      );

      if (axios.isAxiosError(error) && error.response?.status === 401) {
        await handleUnauthorized();
        return;
      }

      Alert.alert("Error", getErrorMessage(error, "Unable to update status."));
    }
  };

  /*
   * DELETE APPLICATION
   */

  const confirmDelete = async () => {
    if (!jobToDelete || deleting) {
      return;
    }

    const deletedJob = jobToDelete;

    try {
      setDeleting(true);

      setJobs((currentJobs) =>
        currentJobs.filter((job) => job._id !== deletedJob._id),
      );

      setJobToDelete(null);

      await api.delete(`/api/jobs/${deletedJob._id}`);
    } catch (error) {
      /*
       * RESTORE JOB
       */

      setJobs((currentJobs) => [deletedJob, ...currentJobs]);

      if (axios.isAxiosError(error) && error.response?.status === 401) {
        await handleUnauthorized();
        return;
      }

      Alert.alert(
        "Error",
        getErrorMessage(error, "Unable to delete application."),
      );
    } finally {
      setDeleting(false);
    }
  };

  /*
   * OPEN JOB LINK
   */

  const openJobUrl = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);

      if (!supported) {
        Alert.alert("Invalid URL", "Unable to open this job link.");

        return;
      }

      await Linking.openURL(url);
    } catch {
      Alert.alert("Error", "Unable to open job link.");
    }
  };

  /*
   * LOGOUT
   */

  const logout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Logout",
        style: "destructive",

        onPress: async () => {
          await SecureStore.deleteItemAsync("token");

          router.replace("/");
        },
      },
    ]);
  };

  /*
   * INITIAL LOADING
   */

  if (initialLoading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: "#09090b",
        }}
      >
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#10b981" />

          <Text className="mt-4 text-zinc-400">Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: "#09090b",
      }}
    >
      <ScrollView
        className="flex-1 bg-zinc-950"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshDashboard}
            tintColor="#10b981"
            colors={["#10b981"]}
          />
        }
      >
        <View className="px-5 pb-32 pt-4">
          {/* HEADER */}

          <View className="mb-7 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600">
                <Text className="text-lg font-bold text-white">JT</Text>
              </View>

              <View className="ml-3">
                <Text className="text-lg font-bold text-white">
                  Job Tracker
                </Text>

                <Text className="text-xs text-zinc-500">Mobile Dashboard</Text>
              </View>
            </View>

            {user && (
              <Pressable
                onPress={logout}
                className="h-11 w-11 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10"
              >
                <Text className="font-bold text-emerald-400">
                  {user.name.charAt(0).toUpperCase()}
                </Text>
              </Pressable>
            )}
          </View>

          {/* WELCOME */}

          <View className="mb-7">
            <Text className="text-3xl font-bold text-white">
              {user ? `Welcome, ${user.name}` : "Dashboard"}
            </Text>

            {user && (
              <Text className="mt-1 text-sm text-zinc-500">{user.email}</Text>
            )}

            <Text className="mt-2 text-zinc-400">
              Manage and track your job search progress.
            </Text>
          </View>

          {/* STATS */}

          <View className="mb-7 flex-row flex-wrap justify-between">
            <StatCard title="Total" value={stats.total} color="#ffffff" />

            <StatCard title="Applied" value={stats.applied} color="#a78bfa" />

            <StatCard
              title="Interview"
              value={stats.interview}
              color="#fbbf24"
            />

            <StatCard title="Offers" value={stats.offer} color="#34d399" />

            <StatCard title="Rejected" value={stats.rejected} color="#fb7185" />
          </View>

          {/* ADD BUTTON */}

          <Pressable
            onPress={openAddModal}
            className="mb-7 items-center rounded-2xl bg-emerald-600 py-4 active:bg-emerald-500"
          >
            <Text className="text-base font-semibold text-white">
              Add Application
            </Text>
          </Pressable>

          {/* SEARCH */}

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search applications..."
            placeholderTextColor="#71717a"
            autoCapitalize="none"
            className="mb-4 rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-4 text-white"
          />

          {/* FILTER */}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-7"
          >
            <Pressable
              onPress={() => setFilterStatus("")}
              className={
                filterStatus === ""
                  ? "mr-2 rounded-full bg-emerald-600 px-5 py-3"
                  : "mr-2 rounded-full border border-zinc-700 bg-zinc-900 px-5 py-3"
              }
            >
              <Text
                className={
                  filterStatus === ""
                    ? "font-medium text-white"
                    : "font-medium text-zinc-400"
                }
              >
                All
              </Text>
            </Pressable>

            {statuses.map((item) => (
              <Pressable
                key={item}
                onPress={() => setFilterStatus(item)}
                className={
                  filterStatus === item
                    ? "mr-2 rounded-full bg-emerald-600 px-5 py-3"
                    : "mr-2 rounded-full border border-zinc-700 bg-zinc-900 px-5 py-3"
                }
              >
                <Text
                  className={
                    filterStatus === item
                      ? "font-medium text-white"
                      : "font-medium text-zinc-400"
                  }
                >
                  {item}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* SECTION TITLE */}

          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-xl font-semibold text-white">
              Applications
            </Text>

            <Text className="text-sm text-zinc-500">
              {filteredJobs.length} found
            </Text>
          </View>

          {/* EMPTY STATE */}

          {filteredJobs.length === 0 ? (
            <View className="items-center rounded-3xl border border-dashed border-zinc-700 bg-zinc-900 px-5 py-12">
              <Text className="text-lg font-semibold text-white">
                No applications
              </Text>

              <Text className="mt-2 text-center text-sm leading-6 text-zinc-500">
                {jobs.length === 0
                  ? "Add your first job application to start tracking your progress."
                  : "Try changing your search or status filter."}
              </Text>
            </View>
          ) : (
            filteredJobs.map((job) => (
              <JobCard
                key={job._id}
                job={job}
                onEdit={() => openEditModal(job)}
                onDelete={() => setJobToDelete(job)}
                onStatusChange={(newStatus) => updateStatus(job, newStatus)}
                onOpenUrl={() => {
                  if (job.jobUrl) {
                    openJobUrl(job.jobUrl);
                  }
                }}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* ADD / EDIT MODAL */}

      <Modal
        visible={applicationModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeApplicationModal}
      >
        <SafeAreaView
          style={{
            flex: 1,
            backgroundColor: "#09090b",
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            className="flex-1 bg-zinc-950"
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              className="flex-1"
            >
              <View className="px-5 pb-10 pt-4">
                {/* MODAL HEADER */}

                <View className="mb-7 flex-row items-center justify-between">
                  <View>
                    <Text className="text-2xl font-bold text-white">
                      {editingJob ? "Edit Application" : "Add Application"}
                    </Text>

                    <Text className="mt-1 text-sm text-zinc-500">
                      {editingJob
                        ? "Update your application details"
                        : "Track a new job application"}
                    </Text>
                  </View>

                  <Pressable
                    onPress={closeApplicationModal}
                    disabled={saving}
                    className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2"
                  >
                    <Text className="font-medium text-zinc-300">Close</Text>
                  </Pressable>
                </View>

                {/* COMPANY */}

                <FormLabel text="Company" />

                <TextInput
                  value={company}
                  onChangeText={setCompany}
                  placeholder="Company name"
                  placeholderTextColor="#71717a"
                  className="mb-5 rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-4 text-white"
                />

                {/* POSITION */}

                <FormLabel text="Position" />

                <TextInput
                  value={position}
                  onChangeText={setPosition}
                  placeholder="Job position"
                  placeholderTextColor="#71717a"
                  className="mb-5 rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-4 text-white"
                />

                {/* LOCATION */}

                <FormLabel text="Location" />

                <TextInput
                  value={location}
                  onChangeText={setLocation}
                  placeholder="Remote / City"
                  placeholderTextColor="#71717a"
                  className="mb-5 rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-4 text-white"
                />

                {/* STATUS */}

                <FormLabel text="Status" />

                <View className="mb-5 flex-row flex-wrap">
                  {statuses.map((item) => (
                    <Pressable
                      key={item}
                      onPress={() => setStatus(item)}
                      className={
                        status === item
                          ? "mb-2 mr-2 rounded-xl bg-emerald-600 px-4 py-3"
                          : "mb-2 mr-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3"
                      }
                    >
                      <Text
                        className={
                          status === item
                            ? "font-medium text-white"
                            : "font-medium text-zinc-400"
                        }
                      >
                        {item}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* DATE */}

                <FormLabel text="Application Date" />

                <TextInput
                  value={appliedDate}
                  onChangeText={setAppliedDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#71717a"
                  keyboardType="numbers-and-punctuation"
                  className="mb-5 rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-4 text-white"
                />

                <Text className="-mt-3 mb-5 text-xs text-zinc-600">
                  Example: 2026-08-08
                </Text>

                {/* URL */}

                <FormLabel text="Job URL" />

                <TextInput
                  value={jobUrl}
                  onChangeText={setJobUrl}
                  placeholder="https://company.com/jobs/..."
                  placeholderTextColor="#71717a"
                  autoCapitalize="none"
                  keyboardType="url"
                  className="mb-5 rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-4 text-white"
                />

                {/* NOTES */}

                <FormLabel text="Notes" />

                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Recruiter details, interview notes or follow-up information..."
                  placeholderTextColor="#71717a"
                  multiline
                  textAlignVertical="top"
                  className="mb-7 min-h-32 rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-4 text-white"
                />

                {/* SAVE */}

                <Pressable
                  onPress={saveApplication}
                  disabled={saving}
                  className="items-center rounded-2xl bg-emerald-600 py-4 active:bg-emerald-500"
                >
                  {saving ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-base font-semibold text-white">
                      {editingJob ? "Save Changes" : "Add Application"}
                    </Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* DELETE MODAL */}

      <Modal
        visible={!!jobToDelete}
        transparent
        animationType="fade"
        onRequestClose={() => setJobToDelete(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/80 px-5">
          <View className="w-full rounded-3xl border border-zinc-700 bg-zinc-900 p-6">
            <Text className="text-2xl font-bold text-white">
              Delete Application
            </Text>

            <Text className="mt-4 leading-6 text-zinc-400">
              Are you sure you want to delete{" "}
              <Text className="font-semibold text-white">
                {jobToDelete?.position}
              </Text>{" "}
              at{" "}
              <Text className="font-semibold text-emerald-400">
                {jobToDelete?.company}
              </Text>
              ?
            </Text>

            <Text className="mt-3 text-sm text-rose-400">
              This action cannot be undone.
            </Text>

            <View className="mt-7 flex-row">
              <Pressable
                onPress={() => setJobToDelete(null)}
                disabled={deleting}
                className="mr-2 flex-1 items-center rounded-2xl border border-zinc-700 bg-zinc-800 py-4"
              >
                <Text className="font-semibold text-zinc-300">Cancel</Text>
              </Pressable>

              <Pressable
                onPress={confirmDelete}
                disabled={deleting}
                className="ml-2 flex-1 items-center rounded-2xl bg-rose-600 py-4"
              >
                {deleting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="font-semibold text-white">Delete</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/*
 * STAT CARD
 */

interface StatCardProps {
  title: string;
  value: number;
  color: string;
}

const StatCard = ({ title, value, color }: StatCardProps) => {
  return (
    <View
      style={{
        width: "48.5%",
      }}
      className="mb-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4"
    >
      <Text className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        {title}
      </Text>

      <Text
        style={{
          color,
        }}
        className="mt-2 text-3xl font-bold"
      >
        {value}
      </Text>
    </View>
  );
};

/*
 * FORM LABEL
 */

const FormLabel = ({ text }: { text: string }) => {
  return (
    <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
      {text}
    </Text>
  );
};

/*
 * JOB CARD
 */

interface JobCardProps {
  job: Job;
  onEdit: () => void;
  onDelete: () => void;
  onOpenUrl: () => void;
  onStatusChange: (status: JobStatus) => void;
}

const JobCard = ({
  job,
  onEdit,
  onDelete,
  onOpenUrl,
  onStatusChange,
}: JobCardProps) => {
  const getStatusColors = (status: JobStatus) => {
    switch (status) {
      case "Applied":
        return {
          background: "#2e1065",
          border: "#7c3aed",
          text: "#c4b5fd",
        };

      case "Interview":
        return {
          background: "#451a03",
          border: "#d97706",
          text: "#fbbf24",
        };

      case "Offer":
        return {
          background: "#022c22",
          border: "#059669",
          text: "#34d399",
        };

      case "Rejected":
        return {
          background: "#4c0519",
          border: "#e11d48",
          text: "#fb7185",
        };
    }
  };

  const currentColors = getStatusColors(job.status);

  return (
    <View className="mb-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
      {/* CARD HEADER */}

      <View className="mb-5 flex-row items-start justify-between">
        <View className="mr-3 flex-1">
          <Text numberOfLines={2} className="text-xl font-semibold text-white">
            {job.position}
          </Text>

          <Text
            numberOfLines={1}
            className="mt-1 text-base font-medium text-emerald-400"
          >
            {job.company}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: currentColors.background,

            borderColor: currentColors.border,
          }}
          className="rounded-full border px-3 py-2"
        >
          <Text
            style={{
              color: currentColors.text,
            }}
            className="text-xs font-semibold"
          >
            {job.status}
          </Text>
        </View>
      </View>

      {/* DETAILS */}

      <Detail label="Location" value={job.location || "Not provided"} />

      <Detail
        label="Applied Date"
        value={
          job.appliedDate
            ? new Date(job.appliedDate).toLocaleDateString()
            : "Not provided"
        }
      />

      {job.notes ? (
        <View className="mb-4">
          <Text className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Notes
          </Text>

          <Text numberOfLines={4} className="mt-1 leading-6 text-zinc-300">
            {job.notes}
          </Text>
        </View>
      ) : null}

      {job.jobUrl ? (
        <Pressable
          onPress={onOpenUrl}
          className="mb-5 self-start rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3"
        >
          <Text className="font-medium text-amber-400">View Job Posting</Text>
        </Pressable>
      ) : null}

      {/* STATUS */}

      <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Update Status
      </Text>

      <View className="mb-5 flex-row flex-wrap">
        {statuses.map((statusItem) => (
          <Pressable
            key={statusItem}
            onPress={() => onStatusChange(statusItem)}
            className={
              job.status === statusItem
                ? "mb-2 mr-2 rounded-xl bg-emerald-600 px-3 py-2"
                : "mb-2 mr-2 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2"
            }
          >
            <Text
              className={
                job.status === statusItem
                  ? "text-xs font-medium text-white"
                  : "text-xs font-medium text-zinc-400"
              }
            >
              {statusItem}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ACTIONS */}

      <View className="flex-row border-t border-zinc-800 pt-4">
        <Pressable
          onPress={onEdit}
          className="mr-2 flex-1 items-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 py-4"
        >
          <Text className="font-semibold text-emerald-400">Edit</Text>
        </Pressable>

        <Pressable
          onPress={onDelete}
          className="ml-2 flex-1 items-center rounded-2xl border border-rose-500/20 bg-rose-500/10 py-4"
        >
          <Text className="font-semibold text-rose-400">Delete</Text>
        </Pressable>
      </View>
    </View>
  );
};

/*
 * DETAIL
 */

const Detail = ({ label, value }: { label: string; value: string }) => {
  return (
    <View className="mb-4">
      <Text className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </Text>

      <Text className="mt-1 text-zinc-300">{value}</Text>
    </View>
  );
};
