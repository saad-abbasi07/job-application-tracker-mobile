import { useState } from "react";

import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    Text,
    TextInput,
    View,
} from "react-native";

import axios from "axios";
import { router } from "expo-router";

import api from "../services/api";
import { saveToken } from "../utils/storage";

interface ApiError {
  message: string;
}

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    if (!email.trim() || !password) {
      if (Platform.OS === "web") {
        window.alert("Please enter your email and password.");
      } else {
        Alert.alert(
          "Missing information",
          "Please enter your email and password.",
        );
      }

      return;
    }

    try {
      setLoading(true);

      const response = await api.post("/api/auth/login", {
        email: email.trim(),
        password,
      });

      await saveToken(response.data.token);

      router.replace("/dashboard");
    } catch (error) {
      let message = "Unable to login.";

      if (axios.isAxiosError<ApiError>(error)) {
        message = error.response?.data?.message || "Unable to login.";
      }

      console.log(
        "LOGIN ERROR:",
        axios.isAxiosError(error) ? error.response?.status : "",
        axios.isAxiosError(error) ? error.response?.data : error,
      );

      if (Platform.OS === "web") {
        window.alert(message);
      } else {
        Alert.alert("Login failed", message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-zinc-950"
    >
      <View className="flex-1 justify-center px-6">
        <View className="mb-8 items-center">
          <View className="mb-5 h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600">
            <Text className="text-xl font-bold text-white">JT</Text>
          </View>

          <Text className="text-3xl font-bold text-white">Job Tracker</Text>

          <Text className="mt-2 text-center text-zinc-400">
            Manage your job applications anywhere
          </Text>
        </View>

        <View className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <Text className="text-2xl font-semibold text-white">
            Welcome back
          </Text>

          <Text className="mt-1 text-zinc-400">Sign in to continue</Text>

          <View className="mt-6">
            <Text className="mb-2 text-sm font-medium text-zinc-300">
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
          </View>

          <View className="mt-4">
            <Text className="mb-2 text-sm font-medium text-zinc-300">
              Password
            </Text>

            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor="#71717a"
              secureTextEntry
              autoCapitalize="none"
              className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-4 text-white"
            />
          </View>

          <Pressable
            onPress={login}
            disabled={loading}
            className="mt-6 items-center rounded-xl bg-emerald-600 py-4 active:bg-emerald-500"
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="font-semibold text-white">Sign In</Text>
            )}
          </Pressable>

          <View className="mt-6 flex-row justify-center">
            <Text className="text-zinc-400">Don't have an account? </Text>

            <Pressable onPress={() => router.push("/register")}>
              <Text className="font-semibold text-amber-400">
                Create account
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
