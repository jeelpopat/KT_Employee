import React, { useState } from "react";
import Modal from "./Modal";
import Button from "./Button";

export const useConfirm = () => {
  const [request, setRequest] = useState(null);

  const confirm = ({ title = "Confirm action", message, confirmLabel = "Confirm", danger = true }) =>
    new Promise((resolve) => {
      setRequest({ title, message, confirmLabel, danger, resolve });
    });

  const close = (result) => {
    request?.resolve(result);
    setRequest(null);
  };

  const dialog = (
    <Modal
      isOpen={Boolean(request)}
      onClose={() => close(false)}
      title={request?.title}
      size="sm"
      closeOnBackdrop={false}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button
            variant={request?.danger ? "danger" : "primary"}
            size="sm"
            onClick={() => close(true)}
          >
            {request?.confirmLabel || "Confirm"}
          </Button>
        </>
      }
    >
      <p>{request?.message}</p>
    </Modal>
  );

  return { confirm, confirmationDialog: dialog };
};

export default useConfirm;
