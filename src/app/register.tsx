import { useState } from "react";

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import axios from "axios";
import { router } from "expo-router";

import api from "../services/api";

interface ApiError {
  message: string;
}

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const showMessage = (title: string, message: string) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const register = async () => {
    if (!name.trim() || !email.trim() || !password) {
      showMessage(
        "Missing information",
        "Please complete all fields."
      );

      return;
    }

    try {
      setLoading(true);

      await api.post("/api/auth/register", {
        name: name.trim(),
        email: email.trim(),
        password,
      });

      // Account successfully created
      if (Platform.OS === "web") {
        window.alert("Account created successfully.");
      }

      // Go directly to Login
      router.replace("/");
    } catch (error) {
      let message = "Unable to create account.";

      if (axios.isAxiosError<ApiError>(error)) {
        message =
          error.response?.data?.message ||
          "Unable to create account.";
      }

      console.log(
        "REGISTER ERROR:",
        axios.isAxiosError(error)
          ? error.response?.status
          : "",
        axios.isAxiosError(error)
          ? error.response?.data
          : error
      );

      showMessage("Registration failed", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-zinc-950"
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="flex-grow justify-center px-6 py-10"
      >
        <View className="mb-8 items-center">
          <View className="mb-5 h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600">
            <Text className="text-xl font-bold text-white">
              JT
            </Text>
          </View>

          <Text className="text-3xl font-bold text-white">
            Create Account
          </Text>

          <Text className="mt-2 text-center text-zinc-400">
            Start tracking your job applications
          </Text>
        </View>

        <View className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <Text className="mb-2 text-sm font-medium text-zinc-300">
            Full name
          </Text>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor="#71717a"
            className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-4 text-white"
          />

          <Text className="mb-2 mt-4 text-sm font-medium text-zinc-300">
            Email
          </Text>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="name@example.com"
            placeholderTextColor="#71717a"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-4 text-white"
          />

          <Text className="mb-2 mt-4 text-sm font-medium text-zinc-300">
            Password
          </Text>

          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Create password"
            placeholderTextColor="#71717a"
            secureTextEntry
            autoCapitalize="none"
            className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-4 text-white"
          />

          <Pressable
            onPress={register}
            disabled={loading}
            className="mt-6 items-center rounded-xl bg-emerald-600 py-4 active:bg-emerald-500"
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="font-semibold text-white">
                Create Account
              </Text>
            )}
          </Pressable>

          <View className="mt-6 flex-row justify-center">
            <Text className="text-zinc-400">
              Already have an account?{" "}
            </Text>

            <Pressable onPress={() => router.replace("/")}>
              <Text className="font-semibold text-amber-400">
                Sign in
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}