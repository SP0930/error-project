import { Router, type IRouter } from "express";
import healthRouter from "./health";
import booksRouter from "./books";
import billsRouter from "./bills";
import reportsRouter from "./reports";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/books", booksRouter);
router.use("/bills", billsRouter);
router.use("/reports", reportsRouter);

export default router;
