import {
  CompilerOptions,
  flattenDiagnosticMessageText,
  createProgram as tsCreateProgram,
  getPreEmitDiagnostics,
  ScriptTarget,
  findConfigFile,
  parseJsonConfigFileContent,
  sys,
  createCompilerHost,
  createSourceFile,
  getDefaultCompilerOptions
} from "typescript";
import * as fs from "fs";
import * as path from "path";

const fileName = normalizeFileName(process.argv[2]);
let fileContents: string = "";

process.stdin.on("data", function(data: string) {
  fileContents = data.toString();
  runDiagnostics();
});

function createProgram() {
  const options = getCompilerOptionsForFile(fileName);
  return tsCreateProgram([fileName], options, compilerHost(options));
}

function runDiagnostics() {
  const program = createProgram();
  const diagnostics = getPreEmitDiagnostics(program);
  diagnostics.forEach(diagnostic => {
    if (diagnostic.file.fileName !== fileName) {
      return;
    }
    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    const message = flattenDiagnosticMessageText(diagnostic.messageText, "\n").split("\n")[0];
    console.log(`${fileName}[${line + 1}, ${character + 1}]: ${message}`);
  });
}

function normalizeFileName(fileName: string) {
  return path.normalize(fileName);
}

function getCompilerOptionsForFile(fileName: string): CompilerOptions {
  const configPath = findConfigFile(fileName, fs.existsSync);
  if (!configPath) {
    return getDefaultCompilerOptions();
  }
  const config = JSON.parse(
    fs.readFileSync(path.normalize(configPath)).toString()
  );
  const { options } = parseJsonConfigFileContent(
    config,
    sys,
    process.cwd(),
    null,
    fileName
  );
  options.noEmit = true;
  return options;
}

function compilerHost(options: CompilerOptions) {
  const host = createCompilerHost(options);
  const parentGetSourceFile = host.getSourceFile;
  const getSourceFile: typeof parentGetSourceFile = (sourceFileName, languageVersion, onError) => {
    if (sourceFileName === fileName) {
      return createSourceFile(
        fileName,
        fileContents,
        languageVersion
      );
    }
    return parentGetSourceFile(sourceFileName, languageVersion, onError);
  };
  host.getSourceFile = getSourceFile;
  return host;
}
