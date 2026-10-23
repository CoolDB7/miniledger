import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View,
} from "react-native";
import { api } from "../api";
import { useAuth } from "../auth";
import { API_URL } from "../config";
import { money } from "../format";
import { colors } from "../theme";
import { Loan, Summary } from "../types";
import type { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

function SummaryCard({ s }: { s: Summary }) {
  return (
    <View style={styles.summary}>
      <Text style={styles.summaryLabel}>Outstanding</Text>
      <Text style={styles.summaryBig}>{money(s.outstanding)}</Text>
      <View style={styles.summaryRow}>
        <Stat label="Total lent" value={money(s.total_lent)} />
        <Stat label="Repaid" value={money(s.total_repaid)} />
        <Stat label="Overdue" value={money(s.overdue_amount)} danger={s.overdue_amount > 0} />
      </View>
    </View>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, danger && { color: "#FFB3B8" }]}>{value}</Text>
    </View>
  );
}

export default function HomeScreen({ navigation }: Props) {
  const { signOut } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={signOut}><Text style={{ color: colors.primary, fontWeight: "600" }}>Logout</Text></Pressable>
      ),
    });
  }, [navigation, signOut]);

  const load = useCallback(async () => {
    try {
      const [l, s] = await Promise.all([api.getLoans(), api.getSummary()]);
      setLoans(l);
      setSummary(s);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  // Reload every time this screen gains focus (e.g. after adding an entry)
  useFocusEffect(useCallback(() => { load().finally(() => setLoading(false)); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const confirmRepay = (loan: Loan) =>
    Alert.alert("Mark as repaid?", `${loan.friend_name} paid back ${money(loan.amount)}`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes, repaid",
        onPress: async () => {
          try { await api.repay(loan.id); await load(); } catch (e) { Alert.alert("Error", (e as Error).message); }
        },
      },
    ]);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />;

  return (
    <View style={styles.container}>
      <FlatList
        data={loans}
        keyExtractor={(l) => String(l.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ListHeaderComponent={
          <>
            {!!error && <Text style={styles.error}>{error}</Text>}
            {summary && <SummaryCard s={summary} />}
          </>
        }
        ListEmptyComponent={<Text style={styles.empty}>No entries yet. Tap "+ Add" to lend some money.</Text>}
        renderItem={({ item }) => {
          const repaid = !!item.repaid_at;
          return (
            <View style={[styles.row, item.is_overdue && styles.rowOverdue, repaid && { opacity: 0.55 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.friend_name}</Text>
                <Text style={[styles.due, item.is_overdue && { color: colors.danger, fontWeight: "700" }]}>
                  {repaid ? "Repaid" : item.is_overdue ? `OVERDUE · was due ${item.due_date}` : `Due ${item.due_date}`}
                </Text>
              </View>
              {item.receipt_url && (
                <Image source={{ uri: `${API_URL}${item.receipt_url}` }} style={styles.thumb} />
              )}
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[styles.amount, item.is_overdue && { color: colors.danger }]}>{money(item.amount)}</Text>
                {!repaid && (
                  <Pressable style={styles.repayBtn} onPress={() => confirmRepay(item)}>
                    <Text style={styles.repayText}>Mark repaid</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        }}
      />
      <Pressable style={styles.fab} onPress={() => navigation.navigate("AddLoan")}>
        <Text style={styles.fabText}>+ Add</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  summary: { backgroundColor: colors.primary, borderRadius: 16, padding: 20, marginBottom: 16 },
  summaryLabel: { color: "#C9D5FF" },
  summaryBig: { color: "#fff", fontSize: 32, fontWeight: "800", marginBottom: 16 },
  summaryRow: { flexDirection: "row" },
  statLabel: { color: "#C9D5FF", fontSize: 12 },
  statValue: { color: "#fff", fontWeight: "700", marginTop: 2 },
  row: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderRadius: 12,
    padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border,
  },
  rowOverdue: { backgroundColor: colors.dangerBg, borderColor: colors.danger, borderLeftWidth: 5 },
  name: { fontSize: 16, fontWeight: "700", color: colors.text },
  due: { color: colors.muted, marginTop: 2, fontSize: 13 },
  amount: { fontSize: 17, fontWeight: "800", color: colors.text },
  thumb: { width: 40, height: 40, borderRadius: 6, marginRight: 10 },
  repayBtn: { marginTop: 6, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, backgroundColor: colors.success },
  repayText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  empty: { textAlign: "center", color: colors.muted, marginTop: 40 },
  error: { color: colors.danger, marginBottom: 12 },
  fab: {
    position: "absolute", right: 20, bottom: 28, backgroundColor: colors.primary,
    paddingVertical: 14, paddingHorizontal: 22, borderRadius: 30, elevation: 4,
  },
  fabText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
