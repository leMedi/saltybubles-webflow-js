"use strict";

const { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } = React;

const Web3Modal = window.Web3Modal.default;

const SALTYBUBLES_SMARTCONTRACT_ADDRESS =
  "0x5A822a4a563B649A6E8Fb8b9df1c087eF6223dc5";
const SALTYBUBLES_ABI = [
  {
    inputs: [
      {
        internalType: "address",
        name: "to",
        type: "address",
      },
    ],
    name: "mint",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "payable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "recipient",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "tokenId",
        type: "uint256",
      },
    ],
    name: "Minted",
    type: "event",
  },
];
const TOKEN_PRICE = "0.0001";
const METADATA_IPFS_BASE_URL =
  "ipfs://bafybeifx4gwcqivqppatsqsgvkvncyjms6ahub535nocnvsgkmeyxnvz3a/";

const providerOptions = {};

let web3Modal;
if (typeof window !== "undefined") {
  web3Modal = new Web3Modal({
    network: "mainnet", // optional
    cacheProvider: true,
    providerOptions,
  });
}

const ipfsLinkToHttp = (ipfs) =>
  `https://cloudflare-ipfs.com/ipfs/${ipfs.substr(7)}`;

const ShowToken = ({ tokenId }) => {
  const [metadata, setMetadata] = useState();

  const getMetadata = useCallback(
    async (tokenId) => {
      setMetadata(null);
      console.log("getMetadata tokenId", tokenId);
      const tokenMetadataUrl = `${METADATA_IPFS_BASE_URL}${tokenId}`;
      console.log(
        "getMetadata tokenMetadataUrl",
        ipfsLinkToHttp(tokenMetadataUrl)
      );
      const metadata = await fetch(ipfsLinkToHttp(tokenMetadataUrl)).then((r) =>
        r.json()
      );
      console.log("getMetadata metadata", metadata);
      setMetadata(metadata);
    },
    [tokenId]
  );

  useEffect(() => {
    getMetadata(tokenId);
  }, [tokenId]);

  if (!metadata) return <p>Fetching metadata</p>;

  return (
    <div>
      <img src={ipfsLinkToHttp(metadata.image)} />
      <h3 style={{color: '#1783d6'}}>{metadata.name}</h3>
    </div>
  );
};


function createWrapperAndAppendToBody(wrapperId) {
  const wrapperElement = document.createElement('div');
  wrapperElement.setAttribute("id", wrapperId);
  document.body.appendChild(wrapperElement);
  return wrapperElement;
}

function ReactPortal({ children, wrapperId = "react-portal-wrapper" }) {
  const [wrapperElement, setWrapperElement] = useState(null);

  useLayoutEffect(() => {
    let element = document.getElementById(wrapperId);
    let systemCreated = false;
    if (!element) {
      systemCreated = true;
      element = createWrapperAndAppendToBody(wrapperId);
    }
    setWrapperElement(element);
  
    return () => {
      if (systemCreated && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    }
  }, [wrapperId]);

  if (wrapperElement === null) return null;

  return ReactDOM.createPortal(children, wrapperElement);
}

function Modal({ children, handleClose }) {
	const nodeRef = useRef(null);
	
  useEffect(() => {
		const closeOnEscapeKey = (e) => (e.key === "Escape" ? handleClose() : null);
		document.body.addEventListener("keydown", closeOnEscapeKey);
		return () => {
			document.body.removeEventListener("keydown", closeOnEscapeKey);
		};
	}, [handleClose]);

	return (
		<ReactPortal>
				<div className="modal" onClick={() => { console.log('clieck modals'); handleClose() }} ref={nodeRef}>
					<div className="modal-content">{children}</div>
				</div>
		</ReactPortal>
	);
}

const MintStatusMessages = {
  'SUBMITED': 'Please Accept Transaction',
  'PENDING': 'Transactions sent to blockchain',
  'SUCCESS': 'Yaaay new token minted',
  'FAILED': 'Ouups',
}

const Mint = ({ address, provider }) => {
  const [mintStatus, setMintStatus] = useState(null);
  const [mintedTokenId, setMintedTokenId] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const signer = useMemo(() => provider.getSigner(), [provider]);
  const contract = useMemo(
    () =>
      new ethers.Contract(
        SALTYBUBLES_SMARTCONTRACT_ADDRESS,
        SALTYBUBLES_ABI,
        signer
      ),
    [signer]
  );

  const mint = useCallback(async () => {
    try {
      console.log(contract);
      setMintedTokenId(null);
      setMintStatus("SUBMITED");
      const mint = await contract.mint(address, {
        value: ethers.utils.parseEther(TOKEN_PRICE),
        gasLimit: 300000,
      });
      setMintStatus("PENDING");
      const txReciept = await mint.wait();
      setMintStatus("SUCCESS");
      const mintedEvent = parseMintEvent(txReciept);
      if (!mintedEvent) return;
      console.log("event", mintedEvent);
      const _mintedTokenId = mintedEvent.args.tokenId;
      setMintedTokenId(_mintedTokenId.toNumber());
    } catch (error) {
      console.error(error);
      setMintStatus("FAILED");
      setErrorMsg(error.message)
    }
  }, [contract]);

  const parseMintEvent = useCallback(
    (txReciept) => {
      for (let i = 0; i < txReciept.logs.length; i++) {
        try {
          const logDescription = contract.interface.parseLog(txReciept.logs[i]);
          if (logDescription.name === "Minted") return logDescription;
        } catch (error) {
          continue;
        }
      }
      return null;
    },
    [contract]
  );

  return (
    <React.Fragment>
      <button className="secondary-btn w-button" onClick={mint}>Mint Your Token</button>
      { mintStatus &&
        (<Modal handleClose={() => setMintStatus(null)}>
          <h3>{MintStatusMessages[mintStatus]}</h3>
          {mintStatus === 'PENDING' && <img src="https://lemedi.github.io/saltybubles-webflow-js/loading.gif" />}
          {errorMsg && <p className="error-msg">{errorMsg}</p>}
          {mintedTokenId && <ShowToken tokenId={mintedTokenId} />}
        </Modal>)
      }
    </React.Fragment>
  );
};

const Main = () => {
  const [web3Provider, setWeb3Provider] = useState(null);
  const [address, setAddress] = useState(null);

  const connect = useCallback(async function () {
    const provider = await web3Modal.connect();

    const _web3Provider = new ethers.providers.Web3Provider(provider);

    const signer = _web3Provider.getSigner();
    const address = await signer.getAddress();

    const network = await _web3Provider.getNetwork();

    setWeb3Provider(_web3Provider);
    setAddress(address);
    console.log("connect done", network, address);
  }, []);

  useEffect(() => {
    if (web3Modal.cachedProvider) {
      connect();
    }
  }, [connect]);

  if (web3Provider && address)
    return <Mint provider={web3Provider} address={address} />;

  return <a className="connect-btn w-button" href="#" onClick={connect}>Connect Wallet</a>;
};

ReactDOM.createRoot(document.getElementById("mint-nft-btn-container")).render(
  React.createElement(Main)
);
