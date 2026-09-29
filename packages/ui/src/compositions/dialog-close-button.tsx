import { XIcon } from "lucide-react";

import { Button } from "../components/button";
import { DialogClose } from "../components/dialog";

const DialogCloseButton = () => (
  <DialogClose
    render={<Button className="absolute top-2 right-2" size="icon-sm" variant="ghost" />}
  >
    <XIcon />
    <span className="sr-only">Fechar</span>
  </DialogClose>
);

export { DialogCloseButton };
