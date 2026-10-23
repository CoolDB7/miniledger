export interface Loan {
  id: number;
  friend_name: string;
  amount: number;
  due_date: string; // YYYY-MM-DD
  repaid_at: string | null;
  receipt_url: string | null;
  is_overdue: boolean; // computed by the server
}

export interface Summary {
  total_lent: number;
  total_repaid: number;
  outstanding: number;
  overdue_amount: number;
}
