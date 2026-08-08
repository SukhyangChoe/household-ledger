"use client";

import {
  useActionState,
  useEffect,
  useRef,
} from "react";

import {
  createAccount,
  deleteAccount,
  setLivingAccount,
  toggleAccountActive,
  updateAccount,
  type AccountActionState,
} from "@/app/settings/accounts/actions";
import { Badge } from "@/components/ui";
import type { Database } from "@/types/database.types";

type Account =
  Database["public"]["Tables"]["accounts"]["Row"];

type Props = {
  accounts: Account[];
};

const initialState: AccountActionState = {
  status: "idle",
  message: "",
};

const ownerLabels: Record<
  Account["owner_type"],
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
  state: AccountActionState;
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

function CreateAccountForm() {
  const detailsRef =
    useRef<HTMLDetailsElement>(null);
  const formRef =
    useRef<HTMLFormElement>(null);

  const [state, formAction, isPending] =
    useActionState(
      createAccount,
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
          새 계좌 등록
        </summary>

        <form
          ref={formRef}
          action={formAction}
          className="border-t border-[var(--border)] p-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">
              계좌명
              <input
                name="name"
                type="text"
                maxLength={50}
                placeholder="예: 아내 생활비 계좌"
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
          </div>

          <label className="mt-4 block text-sm font-medium">
            메모
            <input
              name="memo"
              type="text"
              placeholder="선택 입력"
              className={inputClassName}
            />
          </label>

          <label className="mt-4 flex items-center gap-2 text-sm">
            <input
              name="isLivingAccount"
              type="checkbox"
              className="h-4 w-4 accent-emerald-700"
            />
            대표 생활비 계좌로 등록
          </label>

          <button
            type="submit"
            disabled={isPending}
            className="mt-4 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending
              ? "등록 중..."
              : "계좌 등록"}
          </button>
        </form>
      </details>

      <ActionMessage state={state} />
    </>
  );
}

function AccountRow({
  account,
}: {
  account: Account;
}) {
  const editDetailsRef =
    useRef<HTMLDetailsElement>(null);

  const [
    updateState,
    updateAction,
    updatePending,
  ] = useActionState(
    updateAccount,
    initialState,
  );

  const [
    livingState,
    livingAction,
    livingPending,
  ] = useActionState(
    setLivingAccount,
    initialState,
  );

  const [
    activeState,
    activeAction,
    activePending,
  ] = useActionState(
    toggleAccountActive,
    initialState,
  );

  const [
    deleteState,
    deleteAction,
    deletePending,
  ] = useActionState(
    deleteAccount,
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
                account.is_active
                  ? ""
                  : "text-gray-400 line-through"
              }`}
            >
              {account.name}
            </p>

            {account.is_living_account ? (
              <Badge tone="good">
                대표 생활비 계좌
              </Badge>
            ) : (
              <Badge>일반 계좌</Badge>
            )}

            {!account.is_active ? (
              <Badge tone="warn">
                비활성
              </Badge>
            ) : null}
          </div>

          <p className="mt-1 text-xs text-gray-500">
            {
              ownerLabels[
                account.owner_type
              ]
            }
            {account.memo
              ? ` · ${account.memo}`
              : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {account.is_active &&
          !account.is_living_account ? (
            <form action={livingAction}>
              <input
                type="hidden"
                name="accountId"
                value={account.id}
              />

              <button
                type="submit"
                disabled={livingPending}
                className="rounded-lg border border-emerald-700 px-3 py-2 text-xs font-semibold text-emerald-800 disabled:opacity-60"
              >
                {livingPending
                  ? "변경 중..."
                  : "대표로 지정"}
              </button>
            </form>
          ) : null}

          <form action={activeAction}>
            <input
              type="hidden"
              name="accountId"
              value={account.id}
            />
            <input
              type="hidden"
              name="nextActive"
              value={String(
                !account.is_active,
              )}
            />

            <button
              type="submit"
              disabled={activePending}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold disabled:opacity-60"
            >
              {activePending
                ? "처리 중..."
                : account.is_active
                  ? "비활성화"
                  : "활성화"}
            </button>
          </form>

          {!account.is_living_account ? (
            <form
              action={deleteAction}
              onSubmit={(event) => {
                const confirmed =
                  window.confirm(
                    `"${account.name}" 계좌를 완전히 삭제할까요?\n\n이미 거래 등에 사용된 계좌라면 삭제되지 않습니다.`,
                  );

                if (!confirmed) {
                  event.preventDefault();
                }
              }}
            >
              <input
                type="hidden"
                name="accountId"
                value={account.id}
              />

              <button
                type="submit"
                disabled={deletePending}
                className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletePending
                  ? "삭제 중..."
                  : "삭제"}
              </button>
            </form>
          ) : null}
        </div>
      </div>

      <ActionMessage state={livingState} />
      <ActionMessage state={activeState} />
      <ActionMessage state={deleteState} />

      <details
        ref={editDetailsRef}
        className="mt-4"
      >
        <summary className="cursor-pointer text-sm font-semibold text-gray-600">
          계좌 정보 수정
        </summary>

        <form
          action={updateAction}
          className="mt-3 rounded-xl bg-gray-50 p-4"
        >
          <input
            type="hidden"
            name="accountId"
            value={account.id}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">
              계좌명
              <input
                name="name"
                type="text"
                defaultValue={account.name}
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
                  account.owner_type
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
          </div>

          <label className="mt-4 block text-sm font-medium">
            메모
            <input
              name="memo"
              type="text"
              defaultValue={
                account.memo ?? ""
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

export function AccountManager({
  accounts,
}: Props) {
  return (
    <>
      <CreateAccountForm />

      <div className="mt-5 divide-y divide-[var(--border)]">
        {accounts.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-500">
              아직 등록된 계좌가 없습니다.
            </p>
            <p className="mt-1 text-xs text-gray-400">
              대표 생활비 계좌부터 등록해주세요.
            </p>
          </div>
        ) : (
          accounts.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
            />
          ))
        )}
      </div>
    </>
  );
}
