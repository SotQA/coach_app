import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import type { MessengerType } from "../types/User";

export interface UserContactInfo {
  messengerType: MessengerType | null;
  messengerHandle: string | null;
  loading: boolean;
}

/**
 * Live-subscribes to another user's messenger contact fields so "Text my
 * coach" / "Text student" buttons flip active the moment the other person
 * saves a contact, without requiring a screen revisit.
 */
export function useRealtimeUserContact(userId: string | null | undefined): UserContactInfo {
  const [state, setState] = useState<UserContactInfo>({
    messengerType: null,
    messengerHandle: null,
    loading: Boolean(userId),
  });

  useEffect(() => {
    if (!userId) {
      setState({ messengerType: null, messengerHandle: null, loading: false });
      return;
    }
    setState((prev) => ({ ...prev, loading: true }));
    const unsubscribe = onSnapshot(doc(db, "users", userId), (snap) => {
      const data = snap.data() as { messengerType?: MessengerType | null; messengerHandle?: string | null } | undefined;
      setState({
        messengerType: data?.messengerType ?? null,
        messengerHandle: data?.messengerHandle ?? null,
        loading: false,
      });
    });
    return () => unsubscribe();
  }, [userId]);

  return state;
}
