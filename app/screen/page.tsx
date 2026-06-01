"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from "firebase/auth";
import { auth, db, googleProvider } from "@/lib/firebase";

const ADMIN_EMAIL = "k-yamawaki@u.shukutoku.ac.jp";

type Comment = {
  id: string;
  text: string;
  uid?: string;
  email?: string;
  displayName?: string;
};

type FloatingReaction = {
  id: string;
  emoji: string;
  left: number;
};

export default function ScreenPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [screenStartedAt] = useState(() => Timestamp.fromDate(new Date()));
  const [allComments, setAllComments] = useState<Comment[]>([]);
  const [mutedUids, setMutedUids] = useState<string[]>([]);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);

  const isAdmin = user?.email === ADMIN_EMAIL;

  const comments = allComments.filter((comment) => {
    if (!comment.uid) return true;
    return !mutedUids.includes(comment.uid);
  });

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    const q = query(
      collection(db, "comments"),
      where("status", "==", "visible"),
      where("createdAt", ">=", screenStartedAt),
      orderBy("createdAt", "desc"),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Comment, "id">),
      }));

      setAllComments(data);
    });

    return () => unsubscribe();
  }, [isAdmin, screenStartedAt]);

  useEffect(() => {
    if (!isAdmin) return;

    const q = query(collection(db, "users"), where("commentMuted", "==", true));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMutedUids(snapshot.docs.map((doc) => doc.id));
    });

    return () => unsubscribe();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;

    const q = query(
      collection(db, "reactions"),
      where("createdAt", ">=", screenStartedAt),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type !== "added") return;

        const data = change.doc.data() as { type: "good" | "question" };
        const emoji = data.type === "good" ? "👍" : "❓";

        const reaction: FloatingReaction = {
          id: change.doc.id,
          emoji,
          left: Math.floor(Math.random() * 80) + 10,
        };

        setReactions((prev) => [...prev, reaction]);

        setTimeout(() => {
          setReactions((prev) => prev.filter((r) => r.id !== reaction.id));
        }, 2500);
      });
    });

    return () => unsubscribe();
  }, [isAdmin, screenStartedAt]);

  const login = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const hideComment = async (comment: Comment) => {
    await updateDoc(doc(db, "comments", comment.id), {
      status: "hidden",
      hiddenAt: serverTimestamp(),
    });

    if (!comment.uid) return;

    const userRef = doc(db, "users", comment.uid);
    const userSnap = await getDoc(userRef);
    const currentCount = userSnap.data()?.hiddenCommentCount || 0;
    const nextCount = currentCount + 1;

    await setDoc(
      userRef,
      {
        uid: comment.uid,
        email: comment.email || "",
        displayName: comment.displayName || "",
        hiddenCommentCount: nextCount,
        commentMuted: nextCount >= 2,
        mutedAt: nextCount >= 2 ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  };

  if (!authChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        読み込み中...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
        <div className="rounded-2xl bg-gray-900 p-8 text-center">
          <h1 className="mb-4 text-2xl font-bold">管理者ログイン</h1>
          <button
            onClick={login}
            className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white"
          >
            Googleアカウントでログイン
          </button>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
        <div className="rounded-2xl bg-gray-900 p-8 text-center">
          <h1 className="mb-4 text-2xl font-bold">管理者専用ページです</h1>
          <p className="mb-4 text-sm text-gray-300">
            現在ログイン中：{user.email}
          </p>
          <button onClick={() => signOut(auth)} className="text-sm underline">
            ログアウト
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black p-6 text-white">
      <h1 className="mb-4 text-2xl font-bold tracking-wide">Live Comments</h1>

      <div className="space-y-2">
        {comments.map((comment) => (
          <div
            key={comment.id}
            onDoubleClick={() => hideComment(comment)}
            className="select-none rounded-lg bg-gray-800 px-4 py-2 text-lg leading-snug"
          >
            {comment.text}
          </div>
        ))}
      </div>

      {reactions.map((reaction) => (
        <div
          key={reaction.id}
          className="floating-reaction"
          style={{ left: `${reaction.left}%` }}
        >
          {reaction.emoji}
        </div>
      ))}
    </main>
  );
}