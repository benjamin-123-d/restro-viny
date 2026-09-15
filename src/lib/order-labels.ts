import type { OrderLineState, OrderStatus } from "@/types/order";

export { SERVICE_TYPE_LABEL as ORDER_TYPE_LABEL } from "@/lib/french-vat";

export const ORDER_STATUS_LABEL: Readonly<Record<OrderStatus, string>> = {
  OPEN: "En cours",
  COMPLETED: "Encaissée",
  VOID: "Annulée",
};

export const LINE_STATE_LABEL: Readonly<Record<OrderLineState, string>> = {
  UNSENT: "Non envoyé",
  FIRED: "Envoyé en cuisine",
  PREPARING: "En préparation",
  PREPARED: "Prêt",
  SERVED: "Servi",
  VOID: "Annulé",
};
