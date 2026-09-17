import { html, nothing } from "lit";
import { icons } from "../../components/icons.ts";
import { t } from "../../i18n/index.ts";
import { registerNewSessionSetupEnglish } from "../../i18n/locales/en-new-session-setup.ts";
import { renderSessionMenuItem } from "./cloud-target.ts";
import { isWorktreeNameValid } from "./create-params.ts";
import type { DraftBranches } from "./discovery.ts";

registerNewSessionSetupEnglish();

type CheckoutChipState = Readonly<{
  label: string;
}>;

let fieldDragging = false;

function handleFieldPointer(event: PointerEvent) {
  fieldDragging = event.type === "pointerdown";
}

function handlePopoverHide(event: Event, onHide: () => void) {
  if (event.target !== event.currentTarget) {
    return;
  }
  const active = document.activeElement;
  if (
    active instanceof HTMLInputElement &&
    fieldDragging &&
    active.selectionStart !== active.selectionEnd
  ) {
    fieldDragging = false;
    event.preventDefault();
    return;
  }
  onHide();
}

function setBranchSuggestionsOpen(target: EventTarget | null, open: boolean) {
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const field = target.closest(".new-session-page__branch-field");
  field?.querySelector("wa-popup")?.toggleAttribute("active", open);
  field?.querySelector("input")?.setAttribute("aria-expanded", String(open));
}

export function resolveCheckoutChip(params: {
  destination: "local" | "remote";
  worktree: boolean;
  worktreeAvailable: boolean;
  headBranch?: string;
  baseRef: string;
  repository?: boolean;
}): CheckoutChipState | null {
  if (params.repository) {
    return {
      label: params.baseRef
        ? t("newSession.checkoutRepositoryFrom", { branch: params.baseRef })
        : t("newSession.checkoutRepository"),
    };
  }
  if (params.destination === "local" && !params.worktreeAvailable && !params.worktree) {
    return null;
  }
  if (!params.worktree) {
    return { label: params.headBranch || t("newSession.checkoutCurrent") };
  }
  return {
    label: params.baseRef
      ? t("newSession.checkoutWorktreeFrom", { branch: params.baseRef })
      : t("newSession.checkoutWorktree"),
  };
}

function renderWorktreeFields(params: {
  branches: DraftBranches | null;
  branchesLoading: boolean;
  baseRef: string;
  worktreeName: string;
  submitting: boolean;
  pendingPlacement: boolean;
  onBaseRefInput: (baseRef: string) => void;
  onWorktreeNameInput: (name: string) => void;
  onConfirm: () => void;
  repository?: boolean;
}) {
  const handleFieldKeydown = (event: KeyboardEvent) => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      target.closest("wa-popover")?.removeAttribute("open");
      return;
    }
    const liveWorktreeName =
      target.closest("wa-popover")?.querySelector<HTMLInputElement>("input[data-worktree-name]")
        ?.value ?? params.worktreeName;
    if (
      event.key !== "Enter" ||
      event.isComposing ||
      (!params.repository && !isWorktreeNameValid(liveWorktreeName))
    ) {
      return;
    }
    fieldDragging = false;
    event.preventDefault();
    const popover = target.closest("wa-popover");
    if (popover) {
      const confirmAfterOuterHide = (hideEvent: Event) => {
        if (hideEvent.target !== popover) {
          return;
        }
        popover.removeEventListener("wa-after-hide", confirmAfterOuterHide);
        params.onConfirm();
      };
      popover.addEventListener("wa-after-hide", confirmAfterOuterHide);
      popover.removeAttribute("open");
    }
  };
  const suggestions = (params.branches?.branches ?? []).slice(0, 8);
  const branchName = params.worktreeName.trim();
  const baseRefInput = html`<input
    id="new-session-worktree-base-ref"
    type="text"
    aria-label=${t("newSession.worktreeBaseRef")}
    aria-expanded="false"
    ?disabled=${params.submitting || params.pendingPlacement}
    placeholder=${
      params.branchesLoading
        ? t("common.loading")
        : (params.branches?.defaultBranch ?? t("newSession.worktreeBaseRef"))
    }
    .value=${params.baseRef}
    @focus=${(event: FocusEvent) => setBranchSuggestionsOpen(event.currentTarget, true)}
    @input=${(event: Event) => {
      if (event.currentTarget instanceof HTMLInputElement) {
        setBranchSuggestionsOpen(event.currentTarget, true);
        params.onBaseRefInput(event.currentTarget.value);
      }
    }}
    @keydown=${handleFieldKeydown}
    @pointerdown=${handleFieldPointer}
    @pointerup=${handleFieldPointer}
    @pointercancel=${handleFieldPointer}
  />`;
  return html`
    <div class="new-session-page__menu-field">
      <span>${t("newSession.worktreeBaseRef")}</span>
      ${
        suggestions.length
          ? html`<div
              class="new-session-page__branch-field"
              @focusout=${(event: FocusEvent) => {
                const field = event.currentTarget;
                if (
                  field instanceof HTMLElement &&
                  (!(event.relatedTarget instanceof Node) || !field.contains(event.relatedTarget))
                ) {
                  setBranchSuggestionsOpen(field, false);
                }
              }}
            >
              ${baseRefInput}
              <wa-popup
                class="new-session-page__branch-popup"
                anchor="new-session-worktree-base-ref"
                placement="bottom-start"
                sync="width"
              >
                <div class="new-session-page__branch-suggestions">
                  ${suggestions.map(
                    (branch) => html`<button
                      type="button"
                      class="session-menu__item"
                      data-worktree-suggestion=${branch.name}
                      tabindex="-1"
                      @mousedown=${(event: MouseEvent) => event.preventDefault()}
                      @click=${(event: MouseEvent) => {
                        params.onBaseRefInput(branch.name);
                        setBranchSuggestionsOpen(event.currentTarget, false);
                      }}
                    >
                      <span class="session-menu__text">${branch.name}</span>
                    </button>`,
                  )}
                </div>
              </wa-popup>
            </div>`
          : baseRefInput
      }
    </div>
    <div class="new-session-page__menu-note">
      ${t(
        params.branches?.branchesUnavailable
          ? "newSession.worktreeBranchesUnavailable"
          : "newSession.worktreeBranchesLimited",
      )}
    </div>
    ${
      params.repository
        ? nothing
        : html`<label class="new-session-page__menu-field">
              <span>${t("newSession.worktreeName")}</span>
              <input
                type="text"
                data-worktree-name
                ?disabled=${params.submitting || params.pendingPlacement}
                placeholder=${t("newSession.worktreeNamePlaceholder")}
                .value=${params.worktreeName}
                @input=${(event: Event) => {
                  if (event.currentTarget instanceof HTMLInputElement) {
                    params.onWorktreeNameInput(event.currentTarget.value);
                  }
                }}
                @keydown=${handleFieldKeydown}
                @pointerdown=${handleFieldPointer}
                @pointerup=${handleFieldPointer}
                @pointercancel=${handleFieldPointer}
              />
            </label>
            <div class="new-session-page__menu-note">
              ${
                branchName
                  ? t("newSession.worktreeBranchNote", { branch: `openclaw/${branchName}` })
                  : t("newSession.worktreeBranchFromTitleNote")
              }
            </div>`
    }
  `;
}

export function renderCheckoutChip(params: {
  state: CheckoutChipState;
  remotePlacement: boolean;
  repository?: boolean;
  folderLabel: string;
  worktree: boolean;
  worktreeAvailable: boolean;
  repositoryUnavailable?: boolean;
  branches: DraftBranches | null;
  branchesLoading: boolean;
  baseRef: string;
  worktreeName: string;
  submitting: boolean;
  pendingPlacement: boolean;
  popoverOpen: boolean;
  popoverHiding: boolean;
  onGuardTransition: (event: MouseEvent) => void;
  onPopoverShow: () => void;
  onPopoverHide: () => void;
  onPopoverAfterHide: () => void;
  onSelectWorktree: (value: boolean) => void;
  onBaseRefInput: (baseRef: string) => void;
  onWorktreeNameInput: (name: string) => void;
  onConfirm: () => void;
}) {
  return html`
    <span class="new-session-page__select">
      <button
        id="new-session-checkout-trigger"
        type="button"
        class="new-session-page__trigger ${
          params.popoverHiding ? "new-session-page__trigger--hiding" : ""
        }"
        title=${t("newSession.checkout")}
        aria-label="${t("newSession.checkout")}: ${params.state.label}"
        data-worktree=${String(params.worktree)}
        aria-haspopup="dialog"
        aria-expanded=${String(params.popoverOpen)}
        ?disabled=${params.submitting || params.pendingPlacement}
        @click=${params.onGuardTransition}
      >
        <span class="new-session-page__target-icon" aria-hidden="true">${icons.gitBranch}</span>
        <span class="new-session-page__trigger-label">${params.state.label}</span>
        <span
          class="new-session-page__trigger-chevron new-session-page__trigger-chevron--desktop"
          aria-hidden="true"
          >${icons.chevronDown}</span
        >
        <span
          class="new-session-page__trigger-chevron new-session-page__trigger-chevron--mobile"
          aria-hidden="true"
          >${icons.chevronsUpDown}</span
        >
      </button>
    </span>
    <wa-popover
      class="new-session-page__select new-session-page__checkout-popover new-session-page__picker-popover"
      for="new-session-checkout-trigger"
      placement="bottom-start"
      without-arrow
      @wa-show=${(event: Event) => {
        if (event.target === event.currentTarget) {
          params.onPopoverShow();
        }
      }}
      @wa-hide=${(event: Event) => handlePopoverHide(event, params.onPopoverHide)}
      @wa-after-hide=${(event: Event) => {
        if (event.target === event.currentTarget) {
          params.onPopoverAfterHide();
        }
      }}
    >
      <div class="new-session-page__picker-root">
        <div class="new-session-page__menu-title">${t("newSession.checkout")}</div>
        ${
          params.repository
            ? nothing
            : html`${renderSessionMenuItem(
                {
                  value: "checkout",
                  label: t("newSession.checkoutCurrent"),
                  icon: icons.folder,
                  sub: params.branches?.headBranch,
                  checked: !params.worktree,
                  disabled: params.remotePlacement,
                  title: params.remotePlacement ? t("newSession.checkoutRemoteLocked") : undefined,
                  onSelect: () => params.onSelectWorktree(false),
                  keepOpen: true,
                },
                params.submitting,
              )}
              ${renderSessionMenuItem(
                {
                  value: "worktree",
                  label: t("newSession.checkoutWorktree"),
                  icon: icons.gitBranch,
                  sub: t("newSession.checkoutWorktreeSub"),
                  checked: params.worktree,
                  disabled: !params.worktreeAvailable,
                  title: params.worktreeAvailable
                    ? undefined
                    : params.repositoryUnavailable
                      ? t("newSession.gitCheckUnavailable")
                      : t("newSession.worktreeUnavailable"),
                  onSelect: () => params.onSelectWorktree(true),
                  keepOpen: true,
                },
                params.submitting,
              )} `
        }
        ${params.worktree || params.repository ? renderWorktreeFields(params) : nothing}
        ${
          params.remotePlacement
            ? html`<div class="new-session-page__menu-note">
                ${t(
                  params.repository
                    ? "newSession.placementClonesRepository"
                    : "newSession.placementSyncsFolder",
                  { folder: params.folderLabel },
                )}
              </div>`
            : nothing
        }
      </div>
    </wa-popover>
  `;
}
