"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from "firebase/auth";
import { auth, db, googleProvider } from "@/lib/firebase";

const SESSION_ID = "oc-2026-09-13";
const ADMIN_EMAILS = [
  "k-yamawaki@u.shukutoku.ac.jp",
  "t-sahara@u.shukutoku.ac.jp",
];

const products = [
  {
    value: "jagarico",
    label: "じゃがりこ",
    color: "from-rose-400 to-pink-500",
    badge: "bg-rose-100 text-rose-700",
  },
  {
    value: "jagabee",
    label: "Jagabee",
    color: "from-amber-400 to-orange-500",
    badge: "bg-amber-100 text-amber-800",
  },
  {
    value: "kataage",
    label: "堅あげポテト",
    color: "from-sky-400 to-blue-500",
    badge: "bg-sky-100 text-sky-700",
  },
] as const;

type Choice = (typeof products)[number]["value"];

type Response = {
  id: string;
  choice: Choice;
  choiceLabel: string;
  reason: string;
  status?: "hidden";
  createdAt?: Timestamp | null;
};

export default function OpenCampusQuizScreenPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [responses, setResponses] = useState<Response[]>([]);
  const [subscriptionError, setSubscriptionError] = useState("");
  const [resetting, setResetting] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizStatusReady, setQuizStatusReady] = useState(false);
  const [changingQuizStatus, setChangingQuizStatus] = useState(false);

  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email);

  useEffect(
    () =>
      onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setAuthChecked(true);
      }),
    []
  );

  useEffect(() => {
    if (!isAdmin) return;

    const responsesQuery = query(
      collection(db, "ocSnackResponses"),
      where("sessionId", "==", SESSION_ID)
    );

    return onSnapshot(
      responsesQuery,
      (snapshot) => {
        setSubscriptionError("");
        setResponses(
          snapshot.docs.map(
            (item) => ({ id: item.id, ...item.data() } as Response)
          )
        );
      },
      (error) => {
        console.error(error);
        setSubscriptionError(
          "回答を読み込めませんでした。Firestoreルールを確認してください。"
        );
      }
    );
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;

    const sessionRef = doc(db, "ocSnackSessions", SESSION_ID);

    return onSnapshot(
      sessionRef,
      async (snapshot) => {
        if (!snapshot.exists()) {
          try {
            await setDoc(sessionRef, {
              quizOpen: false,
              updatedAt: serverTimestamp(),
            });
            setQuizOpen(false);
          } catch (error) {
            console.error(error);
          } finally {
            setQuizStatusReady(true);
          }
          return;
        }

        setQuizOpen(snapshot.data()?.quizOpen === true);
        setQuizStatusReady(true);
      },
      (error) => {
        console.error(error);
        setQuizStatusReady(true);
      }
    );
  }, [isAdmin]);

  const counts = useMemo(() => {
    const result: Record<Choice, number> = {
      jagarico: 0,
      jagabee: 0,
      kataage: 0,
    };

    responses.forEach((response) => {
      if (response.choice in result) result[response.choice] += 1;
    });

    return result;
  }, [responses]);

  const comments = useMemo(
    () =>
      responses
        .filter(
          (response) =>
            response.status !== "hidden" && response.reason?.trim()
        )
        .sort(
          (a, b) =>
            (b.createdAt?.toMillis() ?? 0) -
            (a.createdAt?.toMillis() ?? 0)
        ),
    [responses]
  );

  const chartMax = Math.max(20, ...Object.values(counts));

  const login = async () => {
    googleProvider.setCustomParameters({ hd: "u.shukutoku.ac.jp" });
    await signInWithPopup(auth, googleProvider);
  };

  const hideComment = async (response: Response) => {
    await updateDoc(doc(db, "ocSnackResponses", response.id), {
      status: "hidden",
      hiddenAt: serverTimestamp(),
    });
  };

  const toggleQuizOpen = async () => {
    if (!quizStatusReady || changingQuizStatus) return;

    setChangingQuizStatus(true);
    try {
      await setDoc(
        doc(db, "ocSnackSessions", SESSION_ID),
        {
          quizOpen: !quizOpen,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error(error);
      window.alert("クイズ表示の切り替えに失敗しました。Firestoreルールを確認してください。");
    } finally {
      setChangingQuizStatus(false);
    }
  };

  const resetVotes = async () => {
    const confirmed = window.confirm(
      "現在の投票結果をリセットしますか？\nこのセッションの回答データを削除します。"
    );
    if (!confirmed) return;

    setResetting(true);

    try {
      const responsesQuery = query(
        collection(db, "ocSnackResponses"),
        where("sessionId", "==", SESSION_ID)
      );
      const snapshot = await getDocs(responsesQuery);

      const batch = writeBatch(db);
      snapshot.docs.forEach((item) => {
        batch.delete(item.ref);
      });
      await batch.commit();
    } catch (error) {
      console.error(error);
      window.alert(
        "リセットに失敗しました。Firestoreの削除権限を確認してください。"
      );
    } finally {
      setResetting(false);
    }
  };

  if (!authChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-lg font-semibold text-white">
        読み込み中...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
        <section className="w-full max-w-md rounded-3xl bg-white p-8 text-center text-slate-800 shadow-2xl">
          <div className="text-5xl">📊</div>
          <h1 className="mt-4 text-2xl font-bold">管理者ログイン</h1>
          <button
            onClick={login}
            className="mt-6 w-full rounded-2xl bg-blue-600 px-6 py-4 font-bold text-white"
          >
            Googleアカウントでログイン
          </button>
        </section>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
        <section className="rounded-3xl bg-slate-900 p-8 text-center">
          <h1 className="text-2xl font-bold">管理者専用ページです</h1>
          <p className="mt-3 text-slate-300">現在ログイン中：{user.email}</p>
          <button onClick={() => signOut(auth)} className="mt-5 underline">
            ログアウト
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-6 py-4 text-white">
      <div className="mx-auto flex h-[calc(100vh-2rem)] max-w-[1600px] flex-col">
        <header className="flex shrink-0 items-center justify-between gap-5">
          <div>
            <p className="text-[11px] font-bold tracking-[0.22em] text-amber-300">
              OPEN CAMPUS LIVE VOTE
            </p>
            <h1 className="mt-0.5 text-3xl font-bold tracking-tight">
              20〜30代の働く女性をターゲットに開発された商品は？
            </h1>
            <p className={`mt-1 text-xs font-semibold ${quizOpen ? "text-emerald-300" : "text-slate-500"}`}>
              {quizOpen ? "● 参加者画面にクイズを表示中" : "○ 参加者画面は待機中"}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={toggleQuizOpen}
              disabled={!quizStatusReady || changingQuizStatus}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                quizOpen
                  ? "bg-rose-500/20 text-rose-200 ring-1 ring-rose-400/30 hover:bg-rose-500/30"
                  : "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/30 hover:bg-emerald-500/30"
              }`}
            >
              {changingQuizStatus
                ? "切り替え中..."
                : quizOpen
                  ? "受付を終了"
                  : "クイズを開始"}
            </button>

            <button
              onClick={resetVotes}
              disabled={resetting}
              className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-400 transition hover:bg-white/10 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resetting ? "リセット中..." : "投票をリセット"}
            </button>

            <div className="min-w-24 rounded-xl bg-white/10 px-4 py-2 text-center ring-1 ring-white/15">
              <p className="text-[11px] font-medium text-slate-300">回答数</p>
              <p className="mt-0.5 text-2xl font-bold">
                {responses.length}
                <span className="ml-1 text-sm font-semibold">人</span>
              </p>
            </div>
          </div>
        </header>

        {subscriptionError && (
          <p className="mt-3 shrink-0 rounded-xl bg-red-500/20 p-3 text-sm font-semibold text-red-200">
            {subscriptionError}
          </p>
        )}

        <div className="mt-4 grid min-h-0 flex-1 grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-5">
          {/* 左：投票グラフ */}
          <section className="flex min-h-0 flex-col rounded-[28px] bg-white/[0.08] p-5 shadow-2xl ring-1 ring-white/10">
            <div className="grid min-h-0 flex-1 grid-cols-3 gap-6">
              {products.map((product) => {
                const count = counts[product.value];
                const height = count === 0 ? 0 : (count / chartMax) * 100;

                return (
                  <div
                    key={product.value}
                    className="flex min-w-0 flex-col items-center"
                  >
                    <p className="text-2xl font-semibold">
                      {count}
                      <span className="ml-1 text-sm font-medium text-slate-300">
                        人
                      </span>
                    </p>

                    <div className="mt-2 flex min-h-0 w-full flex-1 items-end justify-center px-5 pt-4">
                      <div
                        className={`w-full max-w-72 rounded-t-2xl bg-gradient-to-t ${product.color} shadow-lg shadow-black/10 transition-[height] duration-500 ease-out`}
                        style={{ height: `${height}%` }}
                      />
                    </div>

                    <div className="mt-3 h-px w-full bg-white/10" />

                    <h2 className="mt-3 truncate text-xl font-semibold">
                      {product.label}
                    </h2>
                  </div>
                );
              })}
            </div>

          </section>

          {/* 右：YouTube Live風コメント */}
          <aside className="flex min-h-0 flex-col rounded-[28px] bg-black/20 px-5 py-4 ring-1 ring-white/10">
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 pb-3">
              <div>
                <p className="text-[10px] font-bold tracking-[0.18em] text-slate-500">
                  LIVE COMMENTS
                </p>
                <h2 className="mt-0.5 text-lg font-semibold">そう思った理由</h2>
              </div>
              <span className="text-xs font-medium text-slate-500">
                {comments.length}件
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {comments.map((comment) => {
                const product = products.find(
                  (item) => item.value === comment.choice
                );

                return (
                  <article
                    key={comment.id}
                    onDoubleClick={() => hideComment(comment)}
                    className="select-none border-b border-white/[0.07] py-3.5 last:border-b-0"
                  >
                    <div className="mb-1.5 flex items-center gap-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          product?.badge ?? "bg-slate-700 text-slate-200"
                        }`}
                      >
                        {comment.choiceLabel || product?.label}
                      </span>
                    </div>

                    <p className="text-[15px] font-medium leading-relaxed text-slate-100">
                      {comment.reason}
                    </p>
                  </article>
                );
              })}

              {comments.length === 0 && (
                <div className="flex h-full items-center justify-center px-4 text-center">
                  <p className="text-sm font-medium leading-relaxed text-slate-500">
                    理由が届くと、
                    <br />
                    ここにリアルタイム表示されます
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );

}