import { ZodError } from "zod";
import { CONTRACT_VERSION } from "@demo/config-contracts";
import { loadAndValidate } from "./lib/load-and-validate";

function main() {
  try {
    const { keys, valuesDir } = loadAndValidate();
    console.log(
      `validated ${valuesDir} against contract v${CONTRACT_VERSION}`,
    );
    console.log(`keys: ${keys.join(", ")}`);
    console.log("ok");
  } catch (err) {
    if (err instanceof ZodError) {
      console.error("validation failed:");
      for (const issue of err.issues) {
        const path = issue.path.length ? issue.path.join(".") : "<root>";
        console.error(`  ${path}: ${issue.message}`);
      }
    } else {
      console.error(`validation failed: ${(err as Error).message}`);
    }
    process.exit(1);
  }
}

main();
