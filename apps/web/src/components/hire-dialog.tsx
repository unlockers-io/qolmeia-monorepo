"use client";

import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Field, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { DialogCloseButton } from "@repo/ui/compositions/dialog-close-button";
import { describeRequestError } from "@repo/worker-api";
import { useState } from "react";
import { toast } from "sonner";

import { hireMember, type HireableTemplate } from "@/lib/team";

type HireDialogProps = {
  onClose: () => void;
  onHired: () => void;
  open: boolean;
  template: HireableTemplate | null;
};

const HireDialog = ({ onClose, onHired, open, template }: HireDialogProps) => {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!template) {
      return;
    }
    setBusy(true);
    try {
      const member = await hireMember({
        displayName: name.trim() || undefined,
        templateId: template.id,
      });
      toast.success(`${member.displayName} contratado(a).`);
      onHired();
      onClose();
      setName("");
    } catch (error) {
      toast.error(describeRequestError(error, "Não foi possível contratar. Tente de novo."));
    }
    setBusy(false);
  };

  return (
    <Dialog
      onOpenChange={(o) => {
        if (!o) {
          onClose();
        }
      }}
      open={open}
    >
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogCloseButton />
        <DialogHeader>
          <DialogTitle>Contratar {template?.displayName ?? ""}</DialogTitle>
          <DialogDescription>
            Dê um nome próprio a este agente, se quiser. Em branco, ele se chama{" "}
            {template?.displayName ?? "pelo nome da função"}.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="hire-name">Nome (opcional)</FieldLabel>
          <Input
            disabled={busy}
            id="hire-name"
            onChange={(e) => {
              setName(e.target.value);
            }}
            placeholder={template?.displayName ?? ""}
            value={name}
          />
        </Field>
        <DialogFooter>
          <Button disabled={busy} onClick={onClose} variant="outline">
            Cancelar
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              void confirm();
            }}
          >
            Contratar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export { HireDialog };
