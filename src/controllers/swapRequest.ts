import { Response, Request, json } from "express";
import { ethers } from 'ethers';

const { generateMnemonic } = require('../utils/utils');
import { SwapRequest } from '../models/swap_request';
import BadRequestError from "../exceptions/BadRequestError";
import { http } from "./http";
import * as luxon from 'luxon';



export const checkAndUpdateSwapRequest = async (req: Request, res: Response) => {
	try {
		const { swap_id } = req.body;
    const data = await SwapRequest.findById(swap_id);

    if (data) {
      const current_time = luxon.DateTime.utc();
      const expire_time = luxon.DateTime.fromISO(data.request_time, { zone: "UTC"}).plus({minute: 20});
      if (expire_time > current_time) {
        if (data.is_cardano) {
          let cardanoData = await http.get<any>(`/wallets/${data.cardano_hot_wallet}`);
          console.log('walletData: ', cardanoData);
          if (cardanoData.data.assets.available.length > 0) {
            if (cardanoData.data.assets.available[0].policy_id === "57684adcb032c8dbc40179841bed987d8dee7472617a0e5c25ef4140" &&
              cardanoData.data.assets.available[0].quantity == parseFloat(data.amount)) {
              data.status = "confirmed";
              await data.save();
              // send ethereum token
              const fee = 10;
              const provider = ethers.getDefaultProvider('ropsten')
              const WALLET = data.receiver_address // ADD YOUR WALLET ADDRESS HERE

              let wallet = new ethers.Wallet(process.env.PRIVATE_KEY || 'fdsafdas', provider)
              wallet = wallet.connect(provider)

              const YAY_ADDRESS = '0xc7ad46e0b8a400bb3c915120d284aafba8fc4735' // Ropsten YAY address
              const YAY_ABI = [
                "function balanceOf(address owner) view returns (uint256)",
                "function transfer(address to, uint amount) returns (boolean)"
              ]

              const yay = new ethers.Contract(YAY_ADDRESS, YAY_ABI, wallet);
              const getYayBalance = async () => {
                let balance = await yay.balanceOf(wallet.address)
                balance = ethers.utils.formatEther(balance)
                console.log(balance, 'YAY')
              }
              const sendYay = async () => {
                console.log('Balance before transfer')
                await getYayBalance()
                const to = data.receiver_address // Add your 2nd wallet address here...
                const amount = ethers.utils.parseUnits((parseFloat(data.amount) - fee).toString(), 18); // 1 Dai
                const tx = await yay.transfer(to, amount)
                await tx.wait()
                console.log('Yay Transferred!')
                await getYayBalance()
              }
              try {
                await sendYay();
              } catch (e) {
                return res.status(201).send({status: 'no_enough_pYay_balance'});
              }
              return res.status(201).send({status: 'confirmed'});
            } else {
              return res.status(201).send({status: 'no_yay_received'});
            }
          } else {
            return res.status(201).send({status: 'no_yay_received'});
          }
        } else { // if ethereum
          
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
    const data = new SwapRequest();
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

// export const updateClaim = async (req: Request, res: Response) => {
// 	try {
// 		const { _id } = req.body;
//     const data = await AcceptedAddress.findById(_id);
//     if (data) {
//       data.reinvestable = false;

//       await data.save();
//       return res.status(201).send(data);
//     }
// 	}

// 	catch (error) {
// 		if (error.code === 11000) {
// 			return res.status(400).send(new BadRequestError("ID and/or username already exist."));
// 		}
// 		else {
// 			console.error(error);
// 			return res.status(400).send(new BadRequestError("Bad Request."));
// 		}
// 	}
// };
