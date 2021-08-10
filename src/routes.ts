import { Router } from 'express';

import * as swapRequest from './controllers/swapRequest';

const router: Router = Router();

// router.get('/getClaim/:id', acceptedAddress.getClaim);
router.post('/create-swap', swapRequest.createSwapRequest);
router.post('/check-update-swap', swapRequest.checkAndUpdateSwapRequest);

// router.put('/updateClaim', acceptedAddress.updateClaim);

export default router;