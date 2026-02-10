const fs = require('fs');
const path = require('path');

// Check for arguments
if (process.argv.length < 3) {
  console.error('Usage: node scripts/md-to-walkthrough.js <input-markdown-file> [output-json-file]');
  process.exit(1);
}

const inputPath = process.argv[2];
const outputPath = process.argv[3];
const workspaceRoot = process.cwd();

// Paths
const parserPath = path.join(workspaceRoot, 'out', 'markdownParser.js');
const typesPath = path.join(workspaceRoot, 'out', 'types.js');

// Validation
if (!fs.existsSync(parserPath)) {
  console.error('Error: out/markdownParser.js not found. Please run "npm run compile" first.');
  process.exit(1);
}

if (!fs.existsSync(inputPath)) {
  console.error(`Error: Input file not found: ${inputPath}`);
  process.exit(1);
}

try {
  // Import the parser
  const parser = require(parserPath);
  
  // Read input file
  const markdownContent = fs.readFileSync(inputPath, 'utf-8');
  
  // Parse
  // Note: The parser expects a workspaceRoot for git inference, but it's optional.
  // We pass process.cwd() as workspaceRoot.
  const result = parser.parseMarkdownWalkthrough(markdownContent, workspaceRoot);
  
  // Output warning
  if (result.warnings && result.warnings.length > 0) {
    console.warn('Warnings during conversion:');
    result.warnings.forEach(w => console.warn(`- ${w}`));
  }
  
  const jsonOutput = JSON.stringify(result.walkthrough, null, 2);
  
  if (outputPath) {
    // Write to file
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(outputPath, jsonOutput, 'utf-8');
    console.log(`Successfully converted ${inputPath} to ${outputPath}`);
  } else {
    // Write to stdout
    console.log(jsonOutput);
  }
  
} catch (error) {
  console.error('Conversion failed:', error);
  process.exit(1);
}
