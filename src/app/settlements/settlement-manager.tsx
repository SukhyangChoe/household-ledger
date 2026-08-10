"use client";

import {
  useActionState,
  useMemo,
  useState,
} from "react";

import {
  changeSettlementStatus,
  type SettlementActionState,
} from "@/app/settlements/actions";
import {
  isSettlementIntoLivingAccount,
  isSettlementOutOfLivingAccount,
  type SettlementItem,
} from "@/domain/settlement";

const initialState: SettlementActionState = {
  status: "idle",
  message: "",
  resetKey: "initial",
};

function won(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function dateText(value: string) {
  const [, month, day] = value.split("-");
  return `${Number(month)}.${String(day).padStart(2, "0")}`;
}

function ActionMessage({
  state,
}: {
  state: SettlementActionState;
}) {
  if (state.status === "idle") {
    return null;
  }

  return (
    <p
      className={
        state.status === "success"
          ? "mt-3 text-sm text-emerald-700"
          : "mt-3 text-sm text-red-600"
      }
    >
      {state.message}
    </p>
  );
}

function SettlementGroup({
  title,
  description,
  items,
  selectedIds,
  onToggle,
}: {
  title: string;
  description: string;
  items: SettlementItem[];
  selectedIds: string[];
  onToggle: (transactionId: string) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold">
            {title}
          </h4>
          <p className="mt-1 text-xs text-gray-500">
            {description}
          </p>
        </div>

        <strong className="whitespace-nowrap text-sm">
          {won(
            items.reduce(
              (sum, item) => sum + item.amount,
              0,
            ),
          )}
        </strong>
      </div>

      <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-white">
        {items.map((item) => {
          const checked = selectedIds.includes(
            item.transactionId,
          );

          return (
            <label
              key={item.transactionId}
              className="flex cursor-pointer items-center gap-3 px-3 py-3 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                name="transactionId"
                value={item.transactionId}
                checked={checked}
                onChange={() =>
                  onToggle(item.transactionId)
                }
                className="h-4 w-4 shrink-0 accent-emerald-700"
              />

              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-semibold">
                    {item.name}
                  </span>
                  <span className="shrink-0 text-xs text-gray-400">
                    {dateText(item.effectiveDate)}
                  </span>
                </span>

                <span className="mt-1 block truncate text-xs text-gray-500">
                  {item.directionText}
                </span>
              </span>

              <strong className="shrink-0 text-sm">
                {won(item.amount)}
              </strong>
            </label>
          );
        })}
      </div>
    </section>
  );
}

function splitByCashFlow(items: SettlementItem[]) {
  return {
    intoLivingAccount: items.filter((item) =>
      isSettlementIntoLivingAccount(item.direction),
    ),
    outOfLivingAccount: items.filter((item) =>
      isSettlementOutOfLivingAccount(item.direction),
    ),
  };
}

export function SettlementManager({
  items,
}: {
  items: SettlementItem[];
}) {
  const pendingItems = useMemo(
    () => items.filter((item) => item.completedAt === null),
    [items],
  );
  const completedItems = useMemo(
    () => items.filter((item) => item.completedAt !== null),
    [items],
  );

  const pendingByDirection = useMemo(
    () => splitByCashFlow(pendingItems),
    [pendingItems],
  );
  const completedByDirection = useMemo(
    () => splitByCashFlow(completedItems),
    [completedItems],
  );

  const [pendingSelection, setPendingSelection] =
    useState<{
      resetKey: string;
      ids: string[];
    }>({
      resetKey: initialState.resetKey,
      ids: [],
    });

  const [completedSelection, setCompletedSelection] =
    useState<{
      resetKey: string;
      ids: string[];
    }>({
      resetKey: initialState.resetKey,
      ids: [],
    });

  const [
    completeState,
    completeAction,
    completePending,
  ] = useActionState(
    changeSettlementStatus,
    initialState,
  );

  const [
    reopenState,
    reopenAction,
    reopenPending,
  ] = useActionState(
    changeSettlementStatus,
    initialState,
  );

  const pendingTransactionIds = useMemo(
    () =>
      new Set(
        pendingItems.map((item) => item.transactionId),
      ),
    [pendingItems],
  );

  const completedTransactionIds = useMemo(
    () =>
      new Set(
        completedItems.map((item) => item.transactionId),
      ),
    [completedItems],
  );

  const selectedPendingIds = useMemo(() => {
    if (
      pendingSelection.resetKey !==
      completeState.resetKey
    ) {
      return [];
    }

    return pendingSelection.ids.filter((id) =>
      pendingTransactionIds.has(id),
    );
  }, [
    pendingSelection,
    completeState.resetKey,
    pendingTransactionIds,
  ]);

  const selectedCompletedIds = useMemo(() => {
    if (
      completedSelection.resetKey !==
      reopenState.resetKey
    ) {
      return [];
    }

    return completedSelection.ids.filter((id) =>
      completedTransactionIds.has(id),
    );
  }, [
    completedSelection,
    reopenState.resetKey,
    completedTransactionIds,
  ]);

  function toggleSelection(
    transactionId: string,
    selectedIds: string[],
    resetKey: string,
    setSelection: (
      value: {
        resetKey: string;
        ids: string[];
      },
    ) => void,
  ) {
    const nextIds = selectedIds.includes(transactionId)
      ? selectedIds.filter((id) => id !== transactionId)
      : [...selectedIds, transactionId];

    setSelection({
      resetKey,
      ids: nextIds,
    });
  }

  return (
    <div className="mt-4 space-y-5">
      {pendingItems.length === 0 ? (
        <div className="rounded-xl bg-emerald-50 px-4 py-6 text-center">
          <p className="text-sm font-semibold text-emerald-800">
            이 달에 남아 있는 정산 거래가 없습니다.
          </p>
        </div>
      ) : (
        <form
          action={completeAction}
          className="space-y-5"
        >
          <input
            type="hidden"
            name="nextCompleted"
            value="true"
          />

          <SettlementGroup
            title="생활비 계좌로 받을 금액"
            description="개인 계좌 또는 투자 자금에서 생활비 계좌로 옮길 금액"
            items={pendingByDirection.intoLivingAccount}
            selectedIds={selectedPendingIds}
            onToggle={(transactionId) =>
              toggleSelection(
                transactionId,
                selectedPendingIds,
                completeState.resetKey,
                setPendingSelection,
              )
            }
          />

          <SettlementGroup
            title="생활비 계좌에서 보낼 금액"
            description="개인 계좌 보전 또는 투자 자금으로 옮길 금액"
            items={pendingByDirection.outOfLivingAccount}
            selectedIds={selectedPendingIds}
            onToggle={(transactionId) =>
              toggleSelection(
                transactionId,
                selectedPendingIds,
                completeState.resetKey,
                setPendingSelection,
              )
            }
          />

          {selectedPendingIds.map((transactionId) => (
            <input
              key={transactionId}
              type="hidden"
              name="transactionId"
              value={transactionId}
            />
          ))}

          <button
            type="submit"
            disabled={
              completePending ||
              selectedPendingIds.length === 0
            }
            className="w-full rounded-xl bg-emerald-800 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {completePending
              ? "처리 중..."
              : `선택 ${selectedPendingIds.length}건 정산 완료`}
          </button>

          <ActionMessage state={completeState} />
        </form>
      )}

      {completedItems.length > 0 ? (
        <details className="rounded-xl border border-[var(--border)] bg-gray-50">
          <summary className="cursor-pointer px-4 py-4 text-sm font-semibold">
            정산 완료 내역 {completedItems.length}건
          </summary>

          <form
            action={reopenAction}
            className="space-y-5 border-t border-[var(--border)] p-4"
          >
            <input
              type="hidden"
              name="nextCompleted"
              value="false"
            />

            <SettlementGroup
              title="생활비 계좌로 받은 내역"
              description="생활비 계좌로 들어오는 방향의 정산 완료 내역"
              items={completedByDirection.intoLivingAccount}
              selectedIds={selectedCompletedIds}
              onToggle={(transactionId) =>
                toggleSelection(
                  transactionId,
                  selectedCompletedIds,
                  reopenState.resetKey,
                  setCompletedSelection,
                )
              }
            />

            <SettlementGroup
              title="생활비 계좌에서 보낸 내역"
              description="생활비 계좌에서 나가는 방향의 정산 완료 내역"
              items={completedByDirection.outOfLivingAccount}
              selectedIds={selectedCompletedIds}
              onToggle={(transactionId) =>
                toggleSelection(
                  transactionId,
                  selectedCompletedIds,
                  reopenState.resetKey,
                  setCompletedSelection,
                )
              }
            />

            {selectedCompletedIds.map((transactionId) => (
              <input
                key={transactionId}
                type="hidden"
                name="transactionId"
                value={transactionId}
              />
            ))}

            <button
              type="submit"
              disabled={
                reopenPending ||
                selectedCompletedIds.length === 0
              }
              className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {reopenPending
                ? "처리 중..."
                : `선택 ${selectedCompletedIds.length}건 정산 완료 취소`}
            </button>

            <ActionMessage state={reopenState} />
          </form>
        </details>
      ) : null}
    </div>
  );
}