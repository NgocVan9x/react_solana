import Head from 'next/head'
import { useState, useEffect, useCallback } from "react";
import {
  Connection,
  PublicKey,
  Transaction,
  clusterApiUrl,
  SystemProgram,
} from "@solana/web3.js";



const NETWORK = clusterApiUrl("mainnet-beta");

export default function Home() {
  // const provider = getProvider();
  const [provider, setProvider] = useState();
  const [logs, setLogs] = useState([]);
  const addLog = useCallback(
      (log) => setLogs((logs) => [...logs, "> " + log]),
      []
  );
  const connection = new Connection(NETWORK);
  const [, setConnected] = useState(false);
  const [publicKey, setPublicKey] = useState(null);

  const getProvider = () => {
    if ("solana" in window) {
      const anyWindow = window;
      const provider = anyWindow.solana;
      if (provider.isPhantom) {
        return provider;
      }
    }
    window.open("https://phantom.app/", "_blank");
  };

  useEffect(() => {
    const provider = getProvider();
    setProvider(provider);


    if (!provider) return;
    // try to eagerly connect
    provider.connect({ onlyIfTrusted: true }).catch((err) => {
      // fail silently
    });
    provider.on("connect", (publicKey) => {
      setPublicKey(publicKey);
      setConnected(true);
      addLog("[connect] " + publicKey?.toBase58());
    });
    provider.on("disconnect", () => {
      setPublicKey(null);
      setConnected(false);
      addLog("[disconnect] 👋");
    });
    provider.on("accountChanged", (publicKey) => {
      setPublicKey(publicKey);
      if (publicKey) {
        addLog("[accountChanged] Switched account to " + publicKey?.toBase58());
      } else {
        addLog("[accountChanged] Switched unknown account");
        // In this case, dapps could not to anything, or,
        // Only re-connecting to the new account if it is trusted
        // provider.connect({ onlyIfTrusted: true }).catch((err) => {
        //   // fail silently
        // });
        // Or, always trying to reconnect
        provider
            .connect()
            .then(() => addLog("[accountChanged] Reconnected successfully"))
            .catch((err) => {
              addLog("[accountChanged] Failed to re-connect: " + err.message);
            });
      }
    });
    return () => {
      provider.disconnect();
    };
  }, [provider, addLog]);

  if (!provider) {
    return <h2>Could not find a provider</h2>;
  }



  const createTransferTransaction = async () => {
    if (!provider.publicKey) return;
    let transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: provider.publicKey,
          toPubkey: provider.publicKey,
          lamports: 100,
        })
    );
    transaction.feePayer = provider.publicKey;
    addLog("Getting recent blockhash");
    const anyTransaction = transaction;
    anyTransaction.recentBlockhash = (
        await connection.getRecentBlockhash()
    ).blockhash;
    return transaction;
  };
  const sendTransaction = async () => {
    try {
      const transaction = await createTransferTransaction();
      if (!transaction) return;
      let signed = await provider.signTransaction(transaction);
      addLog("Got signature, submitting transaction");
      let signature = await connection.sendRawTransaction(signed.serialize());
      addLog("Submitted transaction " + signature + ", awaiting confirmation");
      await connection.confirmTransaction(signature);
      addLog("Transaction " + signature + " confirmed");
    } catch (err) {
      console.warn(err);
      addLog("[error] sendTransaction: " + JSON.stringify(err));
    }
  };
  const signMultipleTransactions = async (onlyFirst = false) => {
    try {
      const [transaction1, transaction2] = await Promise.all([
        createTransferTransaction(),
        createTransferTransaction(),
      ]);
      if (transaction1 && transaction2) {
        let txns;
        if (onlyFirst) {
          txns = await provider.signAllTransactions([transaction1]);
        } else {
          txns = await provider.signAllTransactions([
            transaction1,
            transaction2,
          ]);
        }
        addLog("signMultipleTransactions txns: " + JSON.stringify(txns));
      }
    } catch (err) {
      console.warn(err);
      addLog("[error] signMultipleTransactions: " + JSON.stringify(err));
    }
  };
  const signMessage = async (message) => {
    try {
      const data = new TextEncoder().encode(message);
      const res = await provider.signMessage(data);
      addLog("Message signed " + JSON.stringify(res));
    } catch (err) {
      console.warn(err);
      addLog("[error] signMessage: " + JSON.stringify(err));
    }
  };
  return (
    <div className="container">
      <Head>
        <title>Create Next App</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

        <main>
          <h1>Phantom Sandbox</h1>
          {provider && publicKey ? (
              <>
                <div>
                  <pre>Connected as</pre>
                  <br />
                  <pre>{publicKey.toBase58()}</pre>
                  <br />
                </div>
                <button onClick={sendTransaction}>Send Transaction</button>
                <button onClick={() => signMultipleTransactions(false)}>
                  Sign All Transactions (multiple){" "}
                </button>
                <button onClick={() => signMultipleTransactions(true)}>
                  Sign All Transactions (single){" "}
                </button>
                <button
                    onClick={() =>
                        signMessage(
                            "To avoid digital dognappers, sign below to authenticate with CryptoCorgis."
                        )
                    }
                >
                  Sign Message
                </button>
                <button
                    onClick={async () => {
                      try {
                        await provider.disconnect();
                      } catch (err) {
                        console.warn(err);
                        addLog("[error] disconnect: " + JSON.stringify(err));
                      }
                    }}
                >
                  Disconnect
                </button>
              </>
          ) : (
              <>
                <button
                    onClick={async () => {
                      try {
                        await provider.connect();
                      } catch (err) {
                        console.warn(err);
                        addLog("[error] connect: " + JSON.stringify(err));
                      }
                    }}
                >
                  Connect to Phantom
                </button>
              </>
          )}
        </main>
        <footer className="logs">
          {logs.map((log, i) => (
              <div className="log" key={i}>
                {log}
              </div>
          ))}
        </footer>
    </div>
  )
}
