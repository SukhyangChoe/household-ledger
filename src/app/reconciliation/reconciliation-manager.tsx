"use client";

import {
  useActionState,
} from "react";

import {
  saveReconciliation,
  type ReconciliationActionState,
} from "@/app/reconciliation/actions";

type Props = {
  defaultDate: string;
  latestDate: string | null;
  hasBaseline: boolean;
};

const initialState:
  ReconciliationActionState = {
    status: "idle",
    message: "",
    resetKey: "initial",
  };

const inputClassName =
  "mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

export function ReconciliationManager({
  defaultDate,
  latestDate,
  hasBaseline,
}: Props) {
  const [
    state,
    action,
    isPending,
  ] = useActionState(
    saveReconciliation,
    initialState,
  );

  return (
    <div className="mt-4">
      <div
        className={
          hasBaseline
            ? "rounded-xl bg-gray-50 p-4 text-sm leading-6 text-gray-600"
            : "rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-800"
        }
      >
        {hasBaseline
          ? "직전 대조의 실제 잔액을 기준으로 이후 확정 거래와 정산 완료 이동을 반영해 프로그램 장부 잔액을 계산합니다."
          : "첫 잔액 대조는 과거 시작 잔액을 알 수 없으므로 입력한 실제 잔액을 첫 기준점으로 저장합니다. 첫 기록의 차이는 0원으로 시작합니다."}
      </div>

      <form
        key={state.resetKey}
        action={action}
        className="mt-4 grid gap-4 sm:grid-cols-2"
      >
        <label className="text-sm font-medium">
          대조 날짜
          <input
            name="checkedDate"
            type="date"
            min={
              latestDate ??
              undefined
            }
            max={defaultDate}
            defaultValue={
              defaultDate
            }
            required
            className={
              inputClassName
            }
          />
          {latestDate ? (
            <span className="mt-1 block text-xs font-normal text-gray-500">
              최근 대조일{" "}
              {latestDate} 이후
              날짜만 저장할 수
              있습니다. 같은 날짜는
              다시 저장해 갱신할 수
              있습니다.
            </span>
          ) : null}
        </label>

        <label className="text-sm font-medium">
          은행 앱 실제 잔액
          <input
            name="actualBalance"
            type="number"
            step={1}
            inputMode="numeric"
            placeholder="예: 3420000"
            required
            className={
              inputClassName
            }
          />
          <span className="mt-1 block text-xs font-normal text-gray-500">
            대조 날짜의 하루 마감
            기준 잔액을 원 단위로
            입력해주세요.
          </span>
        </label>

        <label className="text-sm font-medium sm:col-span-2">
          메모
          <input
            name="memo"
            type="text"
            maxLength={300}
            placeholder="선택 입력"
            className={
              inputClassName
            }
          />
        </label>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending
              ? "계산·저장 중..."
              : hasBaseline
                ? "잔액 대조 저장"
                : "첫 기준 잔액 저장"}
          </button>

          {state.status !==
          "idle" ? (
            <p
              className={
                state.status ===
                "success"
                  ? "mt-3 text-sm text-emerald-700"
                  : "mt-3 text-sm text-red-600"
              }
            >
              {state.message}
            </p>
          ) : null}
        </div>
      </form>
    </div>
  );
}
