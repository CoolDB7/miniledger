import DateTimePicker from "@react-native-community/datetimepicker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput,
} from "react-native";
import { api } from "../api";
import { toDateString } from "../format";
import { colors } from "../theme";
import type { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "AddLoan">;

export default function AddLoanScreen({ navigation }: Props) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 7 * 86400000)); // default: 1 week out
  const [showPicker, setShowPicker] = useState(Platform.OS === "ios");
  const [receipt, setReceipt] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pickReceipt = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6 });
    if (!result.canceled) setReceipt(result.assets[0]);
  };

  const submit = async () => {
    // Client-side validation (the server validates again)
    const amt = Number(amount);
    if (!name.trim()) return setError("Please enter your friend's name");
    if (!amount || Number.isNaN(amt) || amt <= 0) return setError("Enter a valid amount greater than 0");

    const form = new FormData();
    form.append("friend_name", name.trim());
    form.append("amount", String(amt));
    form.append("due_date", toDateString(dueDate));
    if (receipt) {
      // React Native's FormData accepts { uri, name, type } for files
      form.append("receipt", {
        uri: receipt.uri,
        name: receipt.fileName ?? "receipt.jpg",
        type: receipt.mimeType ?? "image/jpeg",
      } as unknown as Blob);
    }

    setBusy(true);
    setError("");
    try {
      await api.addLoan(form);
      navigation.goBack(); // Home reloads on focus
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Friend's name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Rahul" />

      <Text style={styles.label}>Amount (₹)</Text>
      <TextInput style={styles.input} value={amount} onChangeText={setAmount} placeholder="500" keyboardType="decimal-pad" />

      <Text style={styles.label}>Due date</Text>
      {Platform.OS === "android" && (
        <Pressable style={styles.input} onPress={() => setShowPicker(true)}>
          <Text style={{ fontSize: 16 }}>{toDateString(dueDate)}</Text>
        </Pressable>
      )}
      {showPicker && (
        <DateTimePicker
          value={dueDate}
          mode="date"
          onChange={(_e, d) => {
            if (Platform.OS === "android") setShowPicker(false);
            if (d) setDueDate(d);
          }}
        />
      )}

      <Text style={styles.label}>Receipt photo (optional)</Text>
      <Pressable style={styles.secondary} onPress={pickReceipt}>
        <Text style={styles.secondaryText}>{receipt ? "Change photo" : "Choose photo"}</Text>
      </Pressable>
      {receipt && <Image source={{ uri: receipt.uri }} style={styles.preview} />}

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={[styles.button, busy && { opacity: 0.6 }]} disabled={busy} onPress={submit}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save entry</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  label: { fontWeight: "600", color: colors.text, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 14, fontSize: 16,
  },
  secondary: { borderWidth: 1, borderColor: colors.primary, borderRadius: 10, padding: 12, alignItems: "center" },
  secondaryText: { color: colors.primary, fontWeight: "600" },
  preview: { width: 120, height: 120, borderRadius: 10, marginTop: 10 },
  error: { color: colors.danger, marginTop: 14 },
  button: { backgroundColor: colors.primary, padding: 16, borderRadius: 10, alignItems: "center", marginTop: 24 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
