"use client";

import {
  useActionState,
  useEffect,
  useRef,
} from "react";

import {
  createRateRule,
  createRateRuleVersion,
  type RateRuleActionState,
} from "@/app/settings/rates/actions";
import { Badge } from "@/components/ui";
import type { Database } from "@/types/database.types";

type RateRule =
  Database["public"]["Tables"]["rate_rules"]["Row"];

type Props = {
  rateRules: RateRule[];
  today: string;
};

const initialState: RateRuleActionState = {
  status: "idle",
  message: "",
};

const inputClassName =
  "mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

function formatRate(
  rateBps: number,
) {
  return `${(
    rateBps / 100
  ).toLocaleString("ko-KR", {
    maximumFractionDigits: 2,
  })}%`;
}

function formatRateInput(
  rateBps: number,
) {
  return (rateBps / 100)
    .toFixed(2)
    .replace(/\.?0+$/, "");
}

function formatDate(
  date: string,
) {
  return date.replaceAll(
    "-",
    ".",
  );
}

function addOneDay(
  date: string,
) {
  const [year, month, day] =
    date
      .split("-")
      .map(Number);

  const nextDate = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
    ),
  );

  nextDate.setUTCDate(
    nextDate.getUTCDate() + 1,
  );

  return nextDate
    .toISOString()
    .slice(0, 10);
}

function ActionMessage({
  state,
}: {
  state: RateRuleActionState;
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

function CreateRateRuleForm({
  today,
}: {
  today: string;
}) {
  const detailsRef =
    useRef<HTMLDetailsElement>(null);
  const formRef =
    useRef<HTMLFormElement>(null);

  const [
    state,
    formAction,
    isPending,
  ] = useActionState(
    createRateRule,
    initialState,
  );

  useEffect(() => {
    if (
      state.status === "success"
    ) {
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
          새 반영률 규칙 등록
        </summary>

        <form
          ref={formRef}
          action={formAction}
          className="border-t border-[var(--border)] p-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">
              규칙 이름
              <input
                name="name"
                type="text"
                maxLength={50}
                placeholder="예: 임대소득 전용 반영률"
                required
                className={
                  inputClassName
                }
              />
            </label>

            <label className="text-sm font-medium">
              생활비 반영률
              <div className="relative">
                <input
                  name="ratePercent"
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  placeholder="28.2"
                  required
                  className={`${inputClassName} pr-9`}
                />

                <span className="pointer-events-none absolute right-3 top-1/2 mt-1 -translate-y-1/2 text-sm text-gray-500">
                  %
                </span>
              </div>
            </label>

            <label className="text-sm font-medium">
              적용 시작일
              <input
                name="validFrom"
                type="date"
                defaultValue={
                  today
                }
                max={today}
                required
                className={
                  inputClassName
                }
              />
            </label>

            <label className="text-sm font-medium">
              메모
              <input
                name="memo"
                type="text"
                placeholder="선택 입력"
                className={
                  inputClassName
                }
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="mt-4 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending
              ? "등록 중..."
              : "반영률 규칙 등록"}
          </button>
        </form>
      </details>

      <ActionMessage
        state={state}
      />
    </>
  );
}

function RateRuleItem({
  versions,
  today,
}: {
  versions: RateRule[];
  today: string;
}) {
  const changeDetailsRef =
    useRef<HTMLDetailsElement>(null);

  const current =
    versions.find(
      (version) =>
        version.valid_to ===
        null,
    ) ?? versions[0];

  const nextAllowedDate =
    addOneDay(
      current.valid_from,
    );

  const canCreateVersion =
    current.valid_to === null &&
    nextAllowedDate <= today;

  const [
    state,
    formAction,
    isPending,
  ] = useActionState(
    createRateRuleVersion,
    initialState,
  );

  useEffect(() => {
    if (
      state.status === "success"
    ) {
      changeDetailsRef.current?.removeAttribute(
        "open",
      );
    }
  }, [state]);

  return (
    <div className="py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">
              {current.name}
            </p>

            <Badge tone="good">
              현재 적용
            </Badge>
          </div>

          <p className="mt-1 text-xs text-gray-500">
            {formatDate(
              current.valid_from,
            )}
            부터
          </p>

          {current.memo ? (
            <p className="mt-1 text-xs text-gray-500">
              {current.memo}
            </p>
          ) : null}
        </div>

        <strong className="text-xl">
          {formatRate(
            current.rate_bps,
          )}
        </strong>
      </div>

      <details
        ref={changeDetailsRef}
        className="mt-4"
      >
        <summary className="cursor-pointer text-sm font-semibold text-gray-600">
          반영률 변경
        </summary>

        {canCreateVersion ? (
          <form
            action={formAction}
            className="mt-3 rounded-xl bg-gray-50 p-4"
          >
            <input
              type="hidden"
              name="rateRuleId"
              value={current.id}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">
                규칙 이름
                <input
                  name="name"
                  type="text"
                  defaultValue={
                    current.name
                  }
                  maxLength={50}
                  required
                  className={
                    inputClassName
                  }
                />
              </label>

              <label className="text-sm font-medium">
                새 반영률
                <div className="relative">
                  <input
                    name="ratePercent"
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    defaultValue={formatRateInput(
                      current.rate_bps,
                    )}
                    required
                    className={`${inputClassName} pr-9`}
                  />

                  <span className="pointer-events-none absolute right-3 top-1/2 mt-1 -translate-y-1/2 text-sm text-gray-500">
                    %
                  </span>
                </div>
              </label>

              <label className="text-sm font-medium">
                새 적용 시작일
                <input
                  name="validFrom"
                  type="date"
                  min={
                    nextAllowedDate
                  }
                  max={today}
                  defaultValue={
                    today
                  }
                  required
                  className={
                    inputClassName
                  }
                />
              </label>

              <label className="text-sm font-medium">
                변경 메모
                <input
                  name="memo"
                  type="text"
                  placeholder="예: 생활비 배정 비율 조정"
                  className={
                    inputClassName
                  }
                />
              </label>
            </div>

            <p className="mt-3 text-xs leading-5 text-gray-500">
              기존 버전은 삭제되지
              않고 새 적용일 전날까지의
              이력으로 보존됩니다.
            </p>

            <button
              type="submit"
              disabled={isPending}
              className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isPending
                ? "변경 중..."
                : "새 버전으로 변경"}
            </button>
          </form>
        ) : (
          <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
            오늘 시작된 규칙은 같은
            날 다시 변경할 수 없습니다.
          </p>
        )}
      </details>

      <ActionMessage
        state={state}
      />

      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-semibold text-gray-600">
          변경 이력{" "}
          {versions.length}개
        </summary>

        <div className="mt-3 divide-y divide-[var(--border)] rounded-xl bg-gray-50 px-4">
          {versions.map(
            (version) => (
              <div
                key={
                  version.id
                }
                className="flex items-center justify-between gap-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {
                      version.name
                    }
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    {formatDate(
                      version.valid_from,
                    )}
                    {version.valid_to
                      ? ` ~ ${formatDate(
                          version.valid_to,
                        )}`
                      : "부터"}
                  </p>

                  {version.memo ? (
                    <p className="mt-1 text-xs text-gray-400">
                      {
                        version.memo
                      }
                    </p>
                  ) : null}
                </div>

                <span className="text-sm font-semibold">
                  {formatRate(
                    version.rate_bps,
                  )}
                </span>
              </div>
            ),
          )}
        </div>
      </details>
    </div>
  );
}

export function RateRuleManager({
  rateRules,
  today,
}: Props) {
  const groupedRules =
    Array.from(
      rateRules.reduce(
        (groups, rateRule) => {
          const versions =
            groups.get(
              rateRule.rule_key,
            ) ?? [];

          versions.push(
            rateRule,
          );
          groups.set(
            rateRule.rule_key,
            versions,
          );

          return groups;
        },
        new Map<
          string,
          RateRule[]
        >(),
      ),
    )
      .map(([, versions]) =>
        [...versions].sort(
          (left, right) =>
            right.valid_from.localeCompare(
              left.valid_from,
            ),
        ),
      )
      .sort((left, right) => {
        const leftName =
          left.find(
            (item) =>
              item.valid_to ===
              null,
          )?.name ??
          left[0].name;

        const rightName =
          right.find(
            (item) =>
              item.valid_to ===
              null,
          )?.name ??
          right[0].name;

        return leftName.localeCompare(
          rightName,
          "ko",
        );
      });

  return (
    <>
      <CreateRateRuleForm
        today={today}
      />

      <div className="mt-5 divide-y divide-[var(--border)]">
        {groupedRules.length ===
        0 ? (
          <div className="py-8 text-center text-sm text-gray-500">
            등록된 생활비 반영률이
            없습니다.
          </div>
        ) : (
          groupedRules.map(
            (versions) => (
              <RateRuleItem
                key={
                  versions[0]
                    .rule_key
                }
                versions={
                  versions
                }
                today={today}
              />
            ),
          )
        )}
      </div>
    </>
  );
}
