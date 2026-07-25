import "dotenv/config";

import { prisma } from "@/lib/prisma-client";
import {
  ClinicianCreationError,
  createActiveClinician,
} from "@/server/auth/create-clinician";

const USAGE =
  'Usage: npm run clinician:create -- --email <email> --password "<password>" --name "<full name>"';

export const parseClinicianCreateArguments = (argumentsList) => {
  if (
    argumentsList.length === 3 &&
    argumentsList.every(
      (value) => typeof value === "string" && !value.startsWith("--"),
    )
  ) {
    return {
      email: argumentsList[0],
      password: argumentsList[1],
      fullName: argumentsList[2],
    };
  }

  const supportedOptions = new Set(["--email", "--password", "--name"]);
  const values = {};

  for (let index = 0; index < argumentsList.length; index += 2) {
    const option = argumentsList[index];
    const value = argumentsList[index + 1];

    if (
      !supportedOptions.has(option) ||
      typeof value !== "string" ||
      value.startsWith("--") ||
      option in values
    ) {
      throw new ClinicianCreationError("INVALID_ARGUMENTS", USAGE);
    }

    values[option] = value;
  }

  if (
    argumentsList.length !== 6 ||
    !values["--email"] ||
    !values["--password"] ||
    !values["--name"]
  ) {
    throw new ClinicianCreationError("INVALID_ARGUMENTS", USAGE);
  }

  return {
    email: values["--email"],
    password: values["--password"],
    fullName: values["--name"],
  };
};

const main = async () => {
  try {
    const input = parseClinicianCreateArguments(process.argv.slice(2));
    const clinician = await createActiveClinician(prisma, input);

    console.log(
      `Created clinician ${clinician.email} with status ${clinician.status}.`,
    );
  } catch (error) {
    if (error instanceof ClinicianCreationError) {
      console.error(error.message);
      process.exitCode = 1;
      return;
    }

    console.error("Clinician creation failed due to an internal error.");
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

void main();
