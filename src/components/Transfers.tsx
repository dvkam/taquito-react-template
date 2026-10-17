import { parseTransfer } from "../transfer";
import { useRef, useState, Dispatch, SetStateAction } from "react";
import { TezosToolkit } from "@taquito/taquito";

const Transfers = ({
  Tezos,
  setUserBalance,
  userAddress
}: {
  Tezos: TezosToolkit;
  setUserBalance: Dispatch<SetStateAction<number>>;
  userAddress: string;
}): React.JSX.Element => {
  const [recipient, setRecipient] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const pending = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const sendTransfer = async (): Promise<void> => {
    if (recipient && amount && !pending.current) {
      pending.current = true;
      setError(null);
      setLoading(true);
      try {
        const op = await Tezos.wallet
          .transfer(parseTransfer(recipient, amount))
          .send();
        await op.confirmation();
        if (await op.status() !== "applied") throw new Error("The transaction did not execute successfully.");
        setRecipient("");
        setAmount("");
        const balance = await Tezos.tz.getBalance(userAddress);
        setUserBalance(balance.toNumber());
      } catch (error) {
        setError(error instanceof Error ? error.message : "Transfer failed. Please try again.");
      } finally {
        pending.current = false;
        setLoading(false);
      }
    }
  };

  return (
    <div id="transfer-inputs">
      {error && <p role="alert">{error}</p>}
      <input
        type="text"
        placeholder="Recipient"
        value={recipient}
        onChange={e => setRecipient(e.target.value)}
      />
      <input
        type="number"
        placeholder="Amount"
        value={amount}
        onChange={e => setAmount(e.target.value)}
      />
      <button
        className="button"
        disabled={loading || !recipient || !amount}
        onClick={sendTransfer}
      >
        {loading ? (
          <span>
            <i className="fas fa-spinner fa-spin"></i>&nbsp; Please wait
          </span>
        ) : (
          <span>
            <i className="far fa-paper-plane"></i>&nbsp; Send
          </span>
        )}
      </button>
    </div>
  );
};

export default Transfers;
