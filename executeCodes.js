const os = require("os");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { deleteFile } = require("./deleteFile");

const outputPath = path.join(__dirname, "outputs");
if (!fs.existsSync(outputPath)) {
  fs.mkdirSync(outputPath);
}

const TIMEOUTS = {
  cpp: parseInt(process.env.TIMEOUT_CPP) || 5000,
  python: parseInt(process.env.TIMEOUT_PYTHON) || 5000,
  javascript: parseInt(process.env.TIMEOUT_JS) || 5000,
  java: parseInt(process.env.TIMEOUT_JAVA) || 8000,
};

const compileAndRunCpp = async (filePath, inputPath, jobId) => {
  const isWindows = os.platform() === "win32";
  const executablePath = isWindows
    ? path.join(outputPath, `${jobId}.exe`)
    : path.join(outputPath, `${jobId}`);

  const compileCommand = `g++ ${filePath} -o ${executablePath}`;
  const runCommand = isWindows
    ? `cd ${outputPath} && .\\${jobId}.exe < ${inputPath}`
    : `cd ${outputPath} && ./${jobId} < ${inputPath}`;

  return new Promise((resolve, reject) => {
    exec(compileCommand, { timeout: TIMEOUTS.cpp }, (compileError, _, compileStderr) => {
      if (compileError) return reject({ error: compileError, stderr: compileStderr });
      if (compileStderr) return reject({ stderr: compileStderr });

      exec(runCommand, { timeout: TIMEOUTS.cpp }, (runError, stdout, stderr) => {
        deleteFile(executablePath);
        if (runError) return reject({ error: runError, stderr });
        if (stderr) return reject({ stderr });
        resolve(stdout);
      });
    });
  });
};

const executePython = async (filePath, inputPath) => {
  return new Promise((resolve, reject) => {
    exec(`python3 ${filePath} < ${inputPath}`, { timeout: TIMEOUTS.python }, (error, stdout, stderr) => {
      if (error) return reject({ error, stderr });
      if (stderr) return reject({ stderr });
      resolve(stdout);
    });
  });
};

const executeJavaScript = async (filePath, inputPath) => {
  return new Promise((resolve, reject) => {
    exec(`node ${filePath} < ${inputPath}`, { timeout: TIMEOUTS.javascript }, (error, stdout, stderr) => {
      if (error) return reject({ error, stderr });
      if (stderr) return reject({ stderr });
      resolve(stdout);
    });
  });
};

const compileAndRunJava = async (filePath, inputPath, jobId) => {
  const classDir = path.join(outputPath, jobId);
  fs.mkdirSync(classDir, { recursive: true });

  const compileCommand = `javac -d ${classDir} ${filePath}`;

  return new Promise((resolve, reject) => {
    exec(compileCommand, { timeout: TIMEOUTS.java }, (compileError, _, compileStderr) => {
      if (compileError) return reject({ error: compileError, stderr: compileStderr });

      exec(
        `java -cp ${classDir} Main < ${inputPath}`,
        { timeout: TIMEOUTS.java },
        (runError, stdout, stderr) => {
          fs.rmSync(classDir, { recursive: true, force: true });
          if (runError) return reject({ error: runError, stderr });
          if (stderr) return reject({ stderr });
          resolve(stdout);
        }
      );
    });
  });
};

module.exports = {
  compileAndRunCpp,
  executePython,
  executeJavaScript,
  compileAndRunJava,
};
