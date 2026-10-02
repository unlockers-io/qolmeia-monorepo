import type { ComponentProps } from "react";

import { Spinner } from "../components/spinner";

const LoadingSpinner = (props: ComponentProps<typeof Spinner>) => (
  <Spinner aria-label="Carregando" {...props} />
);

export { LoadingSpinner };
