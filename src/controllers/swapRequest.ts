import { Response, Request, json } from "express";
import Cardano from 'cardano-wallet';

const { generateMnemonic } = require('../utils/utils');
import { SwapRequest } from '../models/swap_request';

import BadRequestError from "../exceptions/BadRequestError";

import * as luxon from 'luxon';

// export const getClaim = async (req: Request, res: Response) => {

// 	try {
// 		let id: string = req.params.id;
// 		const data = await AcceptedAddress.findById(id);
// 		return res.status(200).send(data);
// 	}
	
// 	catch (error) {
// 		console.error(error);
// 		return res.status(400).send(new BadRequestError("Bad Request"));
// 	}
// };

export const checkAndUpdateSwapRequest = async (req: Request, res: Response) => {
	try {
		const { swap_id } = req.body;
    const data = await SwapRequest.findById(swap_id);
    if (data) {
      if (data.is_cardano) {

      }
    } else {
      return res.status(201).send({status: 'no swap id'});
    }

    // const data = new SwapRequest();
    // data.amount = amount;
    // data.is_cardano = is_cardano;
    // data.receiver_address = receiver_address;
    // data.status = 'pending';
    // data.request_time = luxon.DateTime.utc().toString();
    // const MNEMONICS = generateMnemonic(15);
    // const PASSWORD = 'Cardano Rust for the winners!';
    // let settings = Cardano.BlockchainSettings.mainnet();
    // let entropy = Cardano.Entropy.from_english_mnemonics(MNEMONICS);
    // // recover the wallet
    // let wallet = Cardano.Bip44RootPrivateKey.recover(entropy, PASSWORD);

    // // create a wallet account
    // let account = wallet.bip44_account(Cardano.AccountIndex.new(0 | 0x80000000));
    // let account_public = account.public();

    // // create an address
    // let chain_pub = account_public.bip44_chain(false);
    // let key_pub = chain_pub.address_key(Cardano.AddressKeyIndex.new(0));
    // let address = key_pub.bootstrap_era_address(settings);

    // data.cardano_hot_wallet = address.to_base58();
    // await data.save();
    // return res.status(201).send(data);
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

export const createSwapRequest = async (req: Request, res: Response) => {
	try {
		const { amount, is_cardano, receiver_address } = req.body;
    const data = new SwapRequest();
    data.amount = amount;
    data.is_cardano = is_cardano;
    data.receiver_address = receiver_address;
    data.status = 'pending';
    data.request_time = luxon.DateTime.utc().toString();
    if (is_cardano) {
      const MNEMONICS = generateMnemonic(15);
      const PASSWORD = 'Cardano Rust for the winners!';
      let settings = Cardano.BlockchainSettings.mainnet();
      let entropy = Cardano.Entropy.from_english_mnemonics(MNEMONICS);
      // recover the wallet
      let wallet = Cardano.Bip44RootPrivateKey.recover(entropy, PASSWORD);
  
      // create a wallet account
      let account = wallet.bip44_account(Cardano.AccountIndex.new(0 | 0x80000000));
      let account_public = account.public();
  
      // create an address
      let chain_pub = account_public.bip44_chain(false);
      let key_pub = chain_pub.address_key(Cardano.AddressKeyIndex.new(0));
      let address = key_pub.bootstrap_era_address(settings);
  
      data.cardano_hot_wallet = address.to_base58();
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
