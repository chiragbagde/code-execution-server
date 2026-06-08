const express = require("express");
const { compileAndRunCpp, executePython, executeJavaScript, compileAndRunJava } = require("./executeCodes");
const uuid = require("uuid");
const { generateFile, generateInputFile } = require("./generateFile");
const { deleteFile } = require("./deleteFile");
const { containsForbiddenPatterns } = require("./forbiddenPatterns");
const rateLimiter = require("express-rate-limit");

const limiter = rateLimiter({
  windowMs: 60 * 1000,
  max: 50,
  handler: (req, res) =>
    res.status(429).json({ success: false, error: "Too many requests, try again later." }),
});

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json({ limit: "20kb" }));
app.use(limiter);
app.set("trust proxy", 1);

const router = express.Router();
app.use("/api", router);

router.get("/", (req, res) => {
  res.send("<h1>Code Execution</h1>");
});

const EXECUTORS = {
  cpp: compileAndRunCpp,
  python: executePython,
  javascript: executeJavaScript,
  java: compileAndRunJava,
};

async function executeCode(req, res) {
  const { lang = "cpp", code, input } = req.body;

  if (code === undefined) {
    return res.status(400).json({ success: false, error: "Empty code body!" });
  }

  if (containsForbiddenPatterns(code, lang)) {
    return res.status(403).json({ success: false, error: "Code contains forbidden patterns!" });
  }

  const executor = EXECUTORS[lang];
  if (!executor) {
    return res.status(400).json({ success: false, error: "Unsupported language!" });
  }

  const jobId = uuid.v4();
  const filePath = await generateFile(lang, code, jobId);
  const inputPath = await generateInputFile(input, jobId);

  try {
    const output = await executor(filePath, inputPath, jobId);
    res.status(200).json({ output });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ success: false, error: e.message });
  } finally {
    deleteFile(filePath);
    deleteFile(inputPath);
  }
}

router.post("/run", executeCode);
router.post("/submit", executeCode);

app.listen(port, () => {
  console.log(`Code execution server running on port ${port}`);
});
