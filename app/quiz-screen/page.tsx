"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from "firebase/auth";
import { auth, db, googleProvider } from "@/lib/firebase";

const ADMIN_EMAILS = [
  "k-yamawaki@u.shukutoku.ac.jp",
  "t-sahara@u.shukutoku.ac.jp",
];

type QuizResult = {
  uid: string;
  email?: string;
  displayName?: string;
  correctCount?: number;
  total?: number;
  score100?: number;
  percentage?: number;
  level?: number;
  literacyLabel?: string;
  literacyRange?: string;
  completedAt?: Timestamp;
  updatedAt?: Timestamp;
};

type ScoreBucket = {
  label: string;
  literacyLabel: string;
  min: number;
  max: number;
  count: number;
};

function getBucketLabel(score: number) {
  if (score <= 10) return "0〜10点";
  if (score <= 20) return "11〜20点";
  if (score <= 30) return "21〜30点";
  if (score <= 40) return "31〜40点";
  if (score <= 50) return "41〜50点";
  if (score <= 60) return "51〜60点";
  if (score <= 70) return "61〜70点";
  if (score <= 80) return "71〜80点";
  if (score <= 90) return "81〜90点";
  return "91〜100点";
}

function getLiteracyLabelForBucket(label: string) {
  if (
    label === "0〜10点" ||
    label === "11〜20点" ||
    label === "21〜30点" ||
    label === "31〜40点"
  ) {
    return "低リテラシー";
  }

  if (
    label === "41〜50点" ||
    label === "51〜60点" ||
    label === "61〜70点" ||
    label === "71〜80点"
  ) {
    return "中リテラシー";
  }

  return "高リテラシー";
}

export default function QuizScreenPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loginError, setLoginError] = useState("");
  const [results, setResults] = useState<QuizResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      const email = currentUser.email || "";

      if (!ADMIN_EMAILS.includes(email)) {
        setUser(null);
        setLoginError("この画面は教員アカウントのみ利用できます。");
        await signOut(auth);
        setLoading(false);
        return;
      }

      setLoginError("");
      setUser(currentUser);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "quizResults"),
      orderBy("updatedAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const nextResults: QuizResult[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as QuizResult;

        return {
          ...data,
          uid: data.uid || docSnap.id,
        };
      });

      setResults(nextResults);
    });

    return () => unsubscribe();
  }, [user]);

  const stats = useMemo(() => {
    const validResults = results.filter(
      (item) => typeof item.score100 === "number"
    );

    const totalStudents = validResults.length;

    const averageScore =
      totalStudents === 0
        ? 0
        : validResults.reduce((sum, item) => sum + (item.score100 || 0), 0) /
          totalStudents;

    const maxScore =
      totalStudents === 0
        ? 0
        : Math.max(...validResults.map((item) => item.score100 || 0));

    const minScore =
      totalStudents === 0
        ? 0
        : Math.min(...validResults.map((item) => item.score100 || 0));

    const buckets: ScoreBucket[] = [
      { label: "0〜10点", literacyLabel: "低リテラシー", min: 0, max: 10, count: 0 },
      { label: "11〜20点", literacyLabel: "低リテラシー", min: 11, max: 20, count: 0 },
      { label: "21〜30点", literacyLabel: "低リテラシー", min: 21, max: 30, count: 0 },
      { label: "31〜40点", literacyLabel: "低リテラシー", min: 31, max: 40, count: 0 },
      { label: "41〜50点", literacyLabel: "中リテラシー", min: 41, max: 50, count: 0 },
      { label: "51〜60点", literacyLabel: "中リテラシー", min: 51, max: 60, count: 0 },
      { label: "61〜70点", literacyLabel: "中リテラシー", min: 61, max: 70, count: 0 },
      { label: "71〜80点", literacyLabel: "中リテラシー", min: 71, max: 80, count: 0 },
      { label: "81〜90点", literacyLabel: "高リテラシー", min: 81, max: 90, count: 0 },
      { label: "91〜100点", literacyLabel: "高リテラシー", min: 91, max: 100, count: 0 },
    ];

    validResults.forEach((item) => {
      const score = item.score100 || 0;
      const label = getBucketLabel(score);
      const bucket = buckets.find((b) => b.label === label);

      if (bucket) {
        bucket.count += 1;
      }
    });

    const maxBucketCount = Math.max(1, ...buckets.map((bucket) => bucket.count));

    return {
      totalStudents,
      averageScore,
      maxScore,
      minScore,
      buckets,
      maxBucketCount,
    };
  }, [results]);

  const login = async () => {
    try {
      setLoginError("");
      googleProvider.setCustomParameters({ hd: "u.shukutoku.ac.jp" });
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error(error);
      alert("ログインに失敗しました。");
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-slate-900">
        <p className="text-xl font-bold">読み込み中...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center text-slate-800 shadow-2xl">
          <div className="mb-3 text-5xl">📊</div>
          <h1 className="text-2xl font-black">金融リテラシー集計画面</h1>
          <p className="mt-3 text-sm font-bold leading-relaxed text-slate-600">
            この画面は教員アカウントのみ利用できます。
          </p>

          {loginError && (
            <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
              {loginError}
            </p>
          )}

          <button
            onClick={login}
            className="mt-6 w-full rounded-2xl bg-sky-500 px-5 py-4 text-base font-bold text-white shadow-lg active:scale-95"
          >
            教員アカウントでログイン
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white px-8 py-6 text-slate-900">
      <div className="mx-auto max-w-7xl">
        <header className="mb-4 text-center">
          <h1 className="text-4xl font-black leading-tight tracking-tight">
            金融リテラシークイズ 得点分布
          </h1>
          <p className="mt-2 text-xl font-bold text-slate-600">
            10点単位・100点満点
          </p>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white px-8 pb-8 pt-6 shadow-xl">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-black">得点分布</h2>
              <p className="mt-1 text-sm font-bold text-slate-500">
                棒の上の数字は人数を表しています。
              </p>
            </div>

            <div className="rounded-2xl bg-sky-50 px-4 py-3 text-right">
              <p className="text-xs font-bold text-sky-600">リアルタイム更新</p>
              <p className="text-lg font-black text-slate-800">
                回答者数 {stats.totalStudents}人
              </p>
            </div>
          </div>

          <div className="relative mt-4 h-[470px] border-b-4 border-l-4 border-slate-400">
            <div className="absolute inset-0 flex flex-col justify-between pb-0">
              {[4, 3, 2, 1, 0].map((line) => (
                <div
                  key={line}
                  className="h-px w-full bg-slate-200"
                />
              ))}
            </div>

            <div className="relative z-10 flex h-full items-end justify-between gap-4 px-6">
              {stats.buckets.map((bucket) => {
                const heightPercent =
                  bucket.count === 0
                    ? 0
                    : (bucket.count / stats.maxBucketCount) * 100;

                return (
                  <div
                    key={bucket.label}
                    className="flex h-full flex-1 flex-col items-center justify-end"
                  >
                    <div className="flex h-[390px] w-full flex-col items-center justify-end">
                      {bucket.count > 0 && (
                        <p className="mb-2 text-2xl font-black text-slate-900">
                          {bucket.count}
                        </p>
                      )}

                      <div
                        className="w-full max-w-[72px] rounded-t-md bg-sky-500 transition-all duration-500"
                        style={{
                          height: `${heightPercent}%`,
                        }}
                      />
                    </div>

                    <div className="mt-4 min-h-[36px] text-center">
                    <p className="text-base font-black leading-tight text-slate-900">
                        {bucket.label}
                    </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 flex justify-center gap-10 text-xl font-black text-slate-600">
            <div className="flex items-center gap-2">
              <span className="inline-block h-5 w-5 rounded-full bg-rose-500" />
              0〜40点：低リテラシー
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-5 w-5 rounded-full bg-orange-500" />
              41〜80点：中リテラシー
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-5 w-5 rounded-full bg-sky-500" />
              81〜100点：高リテラシー
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-center shadow-sm">
            <p className="text-sm font-bold text-slate-500">回答者数</p>
            <p className="mt-2 text-4xl font-black text-sky-600">
              {stats.totalStudents}
              <span className="text-xl text-slate-500">人</span>
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-center shadow-sm">
            <p className="text-sm font-bold text-slate-500">平均点</p>
            <p className="mt-2 text-4xl font-black text-pink-600">
              {stats.averageScore.toFixed(1)}
              <span className="text-xl text-slate-500">点</span>
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-center shadow-sm">
            <p className="text-sm font-bold text-slate-500">最高点</p>
            <p className="mt-2 text-4xl font-black text-orange-500">
              {stats.maxScore}
              <span className="text-xl text-slate-500">点</span>
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-center shadow-sm">
            <p className="text-sm font-bold text-slate-500">最低点</p>
            <p className="mt-2 text-4xl font-black text-violet-600">
              {stats.minScore}
              <span className="text-xl text-slate-500">点</span>
            </p>
          </div>
        </section>

        <p className="mt-5 text-center text-xs font-bold text-slate-400">
          学生の個人名・メールアドレスはこの画面には表示していません。
        </p>
      </div>
    </main>
  );
}