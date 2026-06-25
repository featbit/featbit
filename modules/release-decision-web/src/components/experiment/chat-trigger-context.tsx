import { createContext, useContext } from "react";

/**
 * Provides a callback that opens the right-panel Codex guide with a pre-built
 * prompt. Usage:
 *
 *   const triggerChat = useChatTrigger();
 *   triggerChat("Analyze experiment X and give a deciding conclusion.");
 *
 * The provider also expands the right panel if it is collapsed.
 */
export const ChatTriggerContext = createContext<
  ((message: string) => void) | null
>(null);

export function useChatTrigger() {
  return useContext(ChatTriggerContext);
}
