"use client";

import {
  useActionState,
  useEffect,
  useRef,
} from "react";

import {
  createCard,
  deleteCard,
  toggleCardActive,
  updateCard,
  type CardActionState,
} from "@/app/settings/cards/actions";
import { Badge } from "@/components/ui";
import type { Database } from "@/types/database.types";

type Account =
  Database["public"]["Tables"]["accounts"]["Row"];

type CardRow =
  Database["public"]["Tables"]["cards"]["Row"];

type Props = {
  accounts: Account[];
  cards: CardRow[];
};

const initialState: CardActionState = {
  status: "idle",
  message: "",
};

const ownerLabels: Record<
  CardRow["owner_type"],
  string
> = {
  wife: "아내",
  husband: "남편",
  joint: "공동",
};

const inputClassName =
  "mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

function ActionMessage({
  state,
}: {
  state: CardActionState;
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

function CreateCardForm({
  accounts,
}: {
  accounts: Account[];
}) {
  const detailsRef =
    useRef<HTMLDetailsElement>(null);
  const formRef =
    useRef<HTMLFormElement>(null);

  const activeAccounts = accounts.filter(
    (account) => account.is_active,
  );

  const [state, formAction, isPending] =
    useActionState(
      createCard,
      initialState,
    );

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      detailsRef.current?.removeAttribute(
        "open",
      );
    }
  }, [state]);

  return (
    <>
      <details
        ref={detailsRef}
        className="mt-4 rounded-2xl border border-[var(--border)] bg-gray-50"
      >
        <summary className="cursor-pointer px-4 py-4 font-semibold">
          새 카드 등록
        </summary>

        <form
          ref={formRef}
          action={formAction}
          className="border-t border-[var(--border)] p-4"
        >
          {activeAccounts.length ===
          0 ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">
              먼저 활성 계좌를
              등록해주세요.
            </p>
          ) : null}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">
              카드명
              <input
                name="name"
                type="text"
                maxLength={50}
                placeholder="예: 남편 신용카드"
                required
                className={inputClassName}
              />
            </label>

            <label className="text-sm font-medium">
              소유자
              <select
                name="ownerType"
                defaultValue="wife"
                className={inputClassName}
              >
                <option value="wife">
                  아내
                </option>
                <option value="husband">
                  남편
                </option>
                <option value="joint">
                  공동
                </option>
              </select>
            </label>

            <label className="text-sm font-medium">
              카드대금 출금 계좌
              <select
                name="paymentAccountId"
                required
                disabled={
                  activeAccounts.length ===
                  0
                }
                className={inputClassName}
              >
                <option value="">
                  계좌 선택
                </option>

                {activeAccounts.map(
                  (account) => (
                    <option
                      key={account.id}
                      value={account.id}
                    >
                      {account.name}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="text-sm font-medium">
              매월 결제일
              <input
                name="paymentDay"
                type="number"
                min={1}
                max={31}
                defaultValue={25}
                required
                className={inputClassName}
              />
            </label>
          </div>

          <label className="mt-4 block text-sm font-medium">
            이용기간 메모
            <input
              name="usagePeriodNote"
              type="text"
              placeholder="예: 전월 14일~당월 13일"
              className={inputClassName}
            />
          </label>

          <button
            type="submit"
            disabled={
              isPending ||
              activeAccounts.length === 0
            }
            className="mt-4 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending
              ? "등록 중..."
              : "카드 등록"}
          </button>
        </form>
      </details>

      <ActionMessage state={state} />
    </>
  );
}

function CardRowItem({
  card,
  accounts,
}: {
  card: CardRow;
  accounts: Account[];
}) {
  const editDetailsRef =
    useRef<HTMLDetailsElement>(null);

  const paymentAccount = accounts.find(
    (account) =>
      account.id ===
      card.payment_account_id,
  );

  const selectableAccounts =
    accounts.filter(
      (account) =>
        account.is_active ||
        account.id ===
          card.payment_account_id,
    );

  const [
    updateState,
    updateAction,
    updatePending,
  ] = useActionState(
    updateCard,
    initialState,
  );

  const [
    activeState,
    activeAction,
    activePending,
  ] = useActionState(
    toggleCardActive,
    initialState,
  );

  const [
    deleteState,
    deleteAction,
    deletePending,
  ] = useActionState(
    deleteCard,
    initialState,
  );

  useEffect(() => {
    if (updateState.status === "success") {
      editDetailsRef.current?.removeAttribute(
        "open",
      );
    }
  }, [updateState]);

  return (
    <div className="py-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={`font-semibold ${
                card.is_active
                  ? ""
                  : "text-gray-400 line-through"
              }`}
            >
              {card.name}
            </p>

            <Badge>
              {
                ownerLabels[
                  card.owner_type
                ]
              }
            </Badge>

            {!card.is_active ? (
              <Badge tone="warn">
                비활성
              </Badge>
            ) : null}
          </div>

          <p className="mt-2 text-xs text-gray-500">
            결제일 매월{" "}
            {card.payment_day}일
          </p>

          <p className="mt-1 text-xs text-gray-500">
            출금 계좌:{" "}
            {paymentAccount?.name ??
              "연결된 계좌 없음"}
            {paymentAccount &&
            !paymentAccount.is_active
              ? " · 비활성 계좌"
              : ""}
          </p>

          {card.usage_period_note ? (
            <p className="mt-1 text-xs text-gray-500">
              {card.usage_period_note}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <form action={activeAction}>
            <input
              type="hidden"
              name="cardId"
              value={card.id}
            />

            <input
              type="hidden"
              name="nextActive"
              value={String(
                !card.is_active,
              )}
            />

            <button
              type="submit"
              disabled={activePending}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold disabled:opacity-60"
            >
              {activePending
                ? "처리 중..."
                : card.is_active
                  ? "비활성화"
                  : "활성화"}
            </button>
          </form>

          <form
            action={deleteAction}
            onSubmit={(event) => {
              const confirmed =
                window.confirm(
                  `"${card.name}" 카드를 완전히 삭제할까요?\n\n거래나 정기항목에 사용된 카드라면 삭제되지 않습니다.`,
                );

              if (!confirmed) {
                event.preventDefault();
              }
            }}
          >
            <input
              type="hidden"
              name="cardId"
              value={card.id}
            />

            <button
              type="submit"
              disabled={deletePending}
              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
            >
              {deletePending
                ? "삭제 중..."
                : "삭제"}
            </button>
          </form>
        </div>
      </div>

      <ActionMessage state={activeState} />
      <ActionMessage state={deleteState} />

      <details
        ref={editDetailsRef}
        className="mt-4"
      >
        <summary className="cursor-pointer text-sm font-semibold text-gray-600">
          카드 정보 수정
        </summary>

        <form
          action={updateAction}
          className="mt-3 rounded-xl bg-gray-50 p-4"
        >
          <input
            type="hidden"
            name="cardId"
            value={card.id}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">
              카드명
              <input
                name="name"
                type="text"
                defaultValue={card.name}
                maxLength={50}
                required
                className={inputClassName}
              />
            </label>

            <label className="text-sm font-medium">
              소유자
              <select
                name="ownerType"
                defaultValue={
                  card.owner_type
                }
                className={inputClassName}
              >
                <option value="wife">
                  아내
                </option>
                <option value="husband">
                  남편
                </option>
                <option value="joint">
                  공동
                </option>
              </select>
            </label>

            <label className="text-sm font-medium">
              카드대금 출금 계좌
              <select
                name="paymentAccountId"
                defaultValue={
                  card.payment_account_id
                }
                required
                className={inputClassName}
              >
                {selectableAccounts.map(
                  (account) => (
                    <option
                      key={account.id}
                      value={account.id}
                    >
                      {account.name}
                      {!account.is_active
                        ? " (비활성)"
                        : ""}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="text-sm font-medium">
              매월 결제일
              <input
                name="paymentDay"
                type="number"
                min={1}
                max={31}
                defaultValue={
                  card.payment_day
                }
                required
                className={inputClassName}
              />
            </label>
          </div>

          <label className="mt-4 block text-sm font-medium">
            이용기간 메모
            <input
              name="usagePeriodNote"
              type="text"
              defaultValue={
                card.usage_period_note ??
                ""
              }
              className={inputClassName}
            />
          </label>

          <button
            type="submit"
            disabled={updatePending}
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {updatePending
              ? "저장 중..."
              : "수정 저장"}
          </button>
        </form>
      </details>

      <ActionMessage state={updateState} />
    </div>
  );
}

export function CardManager({
  accounts,
  cards,
}: Props) {
  return (
    <>
      <CreateCardForm
        accounts={accounts}
      />

      <div className="mt-5 divide-y divide-[var(--border)]">
        {cards.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-500">
              아직 등록된 카드가 없습니다.
            </p>
          </div>
        ) : (
          cards.map((card) => (
            <CardRowItem
              key={card.id}
              card={card}
              accounts={accounts}
            />
          ))
        )}
      </div>
    </>
  );
}
