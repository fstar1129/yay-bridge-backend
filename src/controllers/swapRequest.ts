import { Response, Request, json } from "express";
import { ethers } from 'ethers';
import crypto from 'crypto';
import axios from 'axios';

const { generateMnemonic } = require('../utils/utils');
import { SwapRequest } from '../models/swap_request';
import BadRequestError from "../exceptions/BadRequestError";
import { http } from "./http";
import * as luxon from 'luxon';

// Cardano Yay Policy Id
const YAY_POLICY_ID = '57684adcb032c8dbc40179841bed987d8dee7472617a0e5c25ef4140';
const YAY_UNIT_ID = '57684adcb032c8dbc40179841bed987d8dee7472617a0e5c25ef414059617953776170';
const YAY_ASSET_NAME = '59617953776170';


// Ethereum YAY address
const YAY_ADDRESS = '0x88c9349293d5a69e083d4cf42b343aa00b5d58b8'
const YAY_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint amount) returns (boolean)"
]

// fixed fee
const FEE = parseFloat(process.env.FEE || '1');

export const checkAndUpdateSwapRequest = async (req: Request, res: Response) => {
	try {
		const { swap_id } = req.body;
    let data = await SwapRequest.findById(swap_id);

    if (data) {
      const current_time = luxon.DateTime.utc();
      const expire_time = luxon.DateTime.fromISO(data.request_time, { zone: "UTC"}).plus({minute: 30});
      if (expire_time > current_time) {
        if (data.is_cardano) {
          let config = {
            headers: {
              project_id: process.env.BLOCKFROST_PROJECT_ID,
            }
          };
          const blockfrostUrl = process.env.BLOCKFROST_API_URL || 'https://cardano-mainnet.blockfrost.io/api/v0';
          const blockfrostData = await axios.get(`${blockfrostUrl}/addresses/${data.cardano_hot_wallet_address}`, config);
          // let cardanoData = await http.get<any>(`/wallets/${data.cardano_hot_wallet}`);
          console.log('walletData: ', blockfrostData.data.amount);
          if (blockfrostData.data.amount.length > 0) {
            if (blockfrostData.data.amount[1].unit === YAY_UNIT_ID &&
              blockfrostData.data.amount[1].quantity == parseFloat(data.amount)) {
              // send ethereum token
              // ropsten provider
              const provider = new ethers.providers.JsonRpcProvider(`https://ropsten.infura.io/v3/${process.env.INFURA_KEY}`);
              let wallet = new ethers.Wallet(process.env.ETHEREUM_WALLET_PRIVATE_KEY || '', provider)
              wallet = wallet.connect(provider)

              const yay = new ethers.Contract(YAY_ADDRESS, YAY_ABI, wallet);
              let balance = await yay.balanceOf(wallet.address);
              balance = ethers.utils.formatEther(balance);
              console.log('Balance before transfer');
              console.log(balance, 'YAY');
              const to = data.receiver_address // Add your 2nd wallet address here...
              const amount = ethers.utils.parseUnits((parseFloat(data.amount) - FEE).toString(), 18); // send YAY
              try {
                await yay.transfer(to, amount);
                console.log('Yay Transferred!');
              } catch (e) {
                console.log(e);
                return res.status(201).send({status: 'no_enough_pYay_balance'});
              }
              data.status = "confirmed";
              console.log('data', data);
              await data.save();
              return res.status(201).send({status: 'confirmed'});
            } else {
              return res.status(201).send({status: 'no_yay_received'});
            }
          } else {
            return res.status(201).send({status: 'no_yay_received'});
          }
        } else { // if ethereum
          // eth balance check
          const provider = ethers.getDefaultProvider('ropsten');
          const yay = new ethers.Contract(YAY_ADDRESS, YAY_ABI, provider);
          let balance = await yay.balanceOf(data.eth_hot_wallet);
          balance = ethers.utils.formatEther(balance);
          console.log('balance: ', balance);

          if (balance == parseFloat(data.amount)) {
            // send transaction on cardano
            try {
              let cardanoData = await http.post<any>(`/wallets/${process.env.CARDANO_WALLET_ID}/transactions`, {
                payments: [
                  {
                    address: data.receiver_address,
                    amount: {
                      quantity: 0,
                      unit: "lovelace"
                    },
                    assets: [
                      {
                        policy_id: YAY_POLICY_ID,
                        asset_name: YAY_ASSET_NAME,
                        quantity: parseFloat(data.amount) - FEE
                      }
                    ]
                  }
                ],
                passphrase: process.env.CARDANO_PASS_PHRASE
              });
              console.log("txData: ", cardanoData);
            } catch (e) {
              return res.status(201).send({status: 'no_enough_yay_balance'});
            }

            data.status = "confirmed";
            await data.save();
            return res.status(201).send({status: 'confirmed'});
          } else {
            return res.status(201).send({status: 'no_yay_received'});
          }
        }
      } else {
        data.status = "expired";
        await data.save();
        return res.status(201).send({status: 'expired'});
      }
    } else {
      return res.status(201).send({status: 'no_swap_id'});
    }
	}
	catch (error) {
    console.log(error);
		if (error.code === 11000) {
			return res.status(400).send(new BadRequestError("ID and/or username already exist."));
		}
		else {
			return res.status(400).send(new BadRequestError("Bad Request."));
		}
	}
};

export const createSwapRequest = async (req: Request, res: Response) => {
	try {
		const { amount, is_cardano, receiver_address } = req.body;
    let data = new SwapRequest();
    data.amount = amount;
    data.is_cardano = is_cardano;
    data.receiver_address = receiver_address;
    data.status = 'awaiting';
    data.request_time = luxon.DateTime.utc().toString();
    if (is_cardano) {
      const MNEMONICS = generateMnemonic(15);
      let cardanoData = await http.post<any>("/wallets", {
        name: "test_cf_1",
        mnemonic_sentence: MNEMONICS.split(" "),
        passphrase: "test123456"
      });
      console.log('cardanoWalletId: ', cardanoData.data.id);
      data.cardano_hot_wallet = cardanoData.data.id;
      cardanoData = await http.get<any>(`/wallets/${cardanoData.data.id}/addresses?state=unused`);
      console.log('cardanoWalletAddress: ', cardanoData.data[0].id);
      data.cardano_hot_wallet_address = cardanoData.data[0].id;
    } else { // if ethereum
      const id = crypto.randomBytes(32).toString('hex');
      const privateKey = "0x"+id;
      const wallet = new ethers.Wallet(privateKey);
      data.eth_hot_wallet = wallet.address;
    }
    await data.save();
    return res.status(201).send(data);
	}
	catch (error) {
		if (error.code === 11000) {
			return res.status(400).send(new BadRequestError("ID and/or username already exist."));
		}
		else {
			console.error(error);
			return res.status(400).send(new BadRequestError("Bad Request."));
		}
	}
};
