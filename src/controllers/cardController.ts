import { Request, Response } from 'express';
import * as employeeService from '../services/employeeService.js';
import * as cardService from '../services/cardService.js';
import Cryptr from 'cryptr';

const cryptr = new Cryptr(process.env.CRYPTR_KEY);

export const createCard = async (req: Request, res: Response) => {
	const { employeeId, type } = req.body;
	const employeeIdParams = parseInt(req.params.employeeId);

	employeeService.checkEmployeeId(employeeId, employeeIdParams);
	const employee = await employeeService.employeeValidation(employeeId);
	const cardholderName = employeeService.generateEmployeeCardName(employee.fullName);
	const expirationDate = cardService.generateExpirationDate();
	const number = cardService.generateCardNumber();
	const securityCode = cardService.generateCardCVV();

	const newCard = {
		employeeId,
		number,
		cardholderName,
		securityCode,
		expirationDate,
		password: null,
		isVirtual: false,
		originalCardId: null,
		isBlocked: false,
		type
	};

	await cardService.searchCardByTypeAndEmployeeId(type, employeeId);
	await cardService.insertNewCard(newCard);

	res.sendStatus(201);
}

export const createVirtualCard = async (req: Request, res: Response) => {
	const virtualCardData = req.body;
	const cardIdParams = parseInt(req.params.cardId);

	cardService.checkCardId(virtualCardData.cardId, cardIdParams);
	const searchedCard = await cardService.findCardById(virtualCardData.cardId);
	cardService.isVirtualCard(searchedCard.isVirtual);
	cardService.isValidPassword(virtualCardData.password, searchedCard.password);
	const number = cardService.generateCardNumber();
	const expirationDate = cardService.generateExpirationDate();
	const securityCode = cardService.generateCardCVV();

	const newVirtualCard = {
		...searchedCard,
		number,
		expirationDate,
		securityCode,
		isVirtual: true,
		originalCardId: virtualCardData.cardId
	};

	await cardService.insertNewCard(newVirtualCard);

	res.sendStatus(201);
}

export const deleteVirtualCard = async (req: Request, res: Response) => {
	const virtualCardData = req.body;
	const cardIdParams = parseInt(req.params.cardId);

	cardService.checkCardId(virtualCardData.cardId, cardIdParams);
	const searchedCard = await cardService.findCardById(virtualCardData.cardId);
	cardService.isNotVirtualCard(searchedCard.isVirtual);
	cardService.isValidPassword(virtualCardData.password, searchedCard.password);

	cardService.deleteVirtualCard(virtualCardData.cardId);

	res.sendStatus(200);
}

export const activationCard = async (req: Request, res: Response) => {
	const cardData = req.body;
	const cardIdParams = parseInt(req.params.cardId);

	cardService.checkCardId(cardData.cardId, cardIdParams);
	const searchedCard = await cardService.findCardById(cardData.cardId);
	cardService.isVirtualCard(searchedCard.isVirtual);
	cardService.expirationDateValid(searchedCard.expirationDate);
	cardService.isActivatedCard(searchedCard.password);
	cardService.isValidCVV(cardData.securityCode, searchedCard.securityCode);
	const passwordHashed = cardService.cardPasswordHashed(cardData.password);

	const activatedCard = {
		...searchedCard,
		password: passwordHashed
	};

	await cardService.activeCard(cardData.cardId, activatedCard);

	res.sendStatus(200);
}

export const manageCard = async (req: Request, res: Response) => {
	const cardData = req.body;
	const cardIdParams = parseInt(req.params.cardId);

	cardService.checkCardId(cardData.cardId, cardIdParams);
	const searchedCard = await cardService.findCardById(cardData.cardId);
	cardService.expirationDateValid(searchedCard.expirationDate);
	cardService.isValidPassword(cardData.password, searchedCard.password);

	if (req.path.includes('block')) {
		cardService.isBlockedCard(searchedCard.isBlocked);
		searchedCard.isBlocked = true;
	}

	if (req.path.includes('unlock')) {
		cardService.isNotBlockedCard(searchedCard.isBlocked);
		searchedCard.isBlocked = false;
	}

	cardService.blockCard(searchedCard.id, searchedCard);

	res.sendStatus(200);
}

export const balanceCard = async (req: Request, res: Response) => {
	const cardId = parseInt(req.params.cardId);

	const searchedCard = await cardService.findCardById(cardId);
	const searchedPayments = await cardService.paymentsCard(
		searchedCard.isVirtual ? searchedCard.originalCardId : searchedCard.id
	);
	const searchedRecharges = await cardService.rechargesCard(
		searchedCard.isVirtual ? searchedCard.originalCardId : searchedCard.id
	);
	const balance = cardService.balanceCard(searchedPayments, searchedRecharges);

	const totalBalance = {
		balance,
		transactions: searchedPayments,
		recharges: searchedRecharges
	};

	res.status(200).send(totalBalance);
}

export const getCard = async (req: Request, res: Response) => {
	const cardId = parseInt(req.params.cardId);

	const searchedCard = await cardService.findCardById(cardId);

	res.send({ ...searchedCard, securityCode: cryptr.decrypt(searchedCard.securityCode) });
}
