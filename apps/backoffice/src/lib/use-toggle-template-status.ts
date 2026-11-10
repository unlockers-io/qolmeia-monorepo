import { describeRequestError } from "@repo/worker-api";
import type { Template, TemplateStatus } from "@repo/worker-api/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { setTemplateStatus, templateKeys } from "@/lib/backoffice-api";

const NEXT_STATUS = {
  active: "retired",
  retired: "active",
} satisfies Record<TemplateStatus, TemplateStatus>;

const TOGGLE_LABEL = {
  active: "Desativar",
  retired: "Reativar",
} satisfies Record<TemplateStatus, string>;

const TOGGLED_TOAST = {
  active: "Modelo reativado.",
  retired: "Modelo desativado.",
} satisfies Record<TemplateStatus, string>;

const useToggleTemplateStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (template: Pick<Template, "id" | "status">) =>
      setTemplateStatus(template.id, NEXT_STATUS[template.status]),
    onError: (error) => {
      toast.error(describeRequestError(error, "Não foi possível alterar o status."));
    },
    onSuccess: async ({ template }) => {
      await queryClient.invalidateQueries({ queryKey: templateKeys.all });
      toast.success(TOGGLED_TOAST[template.status]);
    },
  });
};

export { NEXT_STATUS, TOGGLE_LABEL, useToggleTemplateStatus };
