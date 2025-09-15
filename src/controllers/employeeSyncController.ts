import { Request, Response } from "express";
import axios from "axios";
import { parseStringPromise } from "xml2js";
import prisma from "../database/db";
import { AppError } from "../samples/errorHandler";

export async function syncEmployees(req: Request, res: Response) {
  try {
    const apiUrl = "https://erp.dca.org.sa/WebService/ListEmployees.asmx/ListInfo";
    const params = {
      auth_key: "DCA@987654321",
      Facility_ID: 1
    };

    // 1. Call the API
    const { data } = await axios.get(apiUrl, { params });

    // 2. Parse XML to get the JSON string
    const parsed = await parseStringPromise(data, { explicitArray: false });
    const employeesRawString = parsed?.anyType?._ || null;

    if (!employeesRawString) {
      throw new AppError("No employee data found in ERP API response", 500);
    }

    // 3. Convert JSON string to array of employees
    const employees = JSON.parse(employeesRawString);

    let inserted = 0;
    let skipped = 0;

    // 4. Loop through employees
    for (const emp of employees) {
      const empId = emp.Emp_ID?.toString();
      const name = emp.English_name?.toString();
      const email = emp.Email || null;
      const department = emp.Dep_Name || null;
      const position = emp.Cat_name || null;

      if (!empId || !name) {
        skipped++;
        continue;
      }

      // 5. Check for existing employee
      const existing = await prisma.employee.findFirst({
        where: { empId, deletedAt: null }
      });

      if (existing) {
        skipped++;
        continue;
      }

      // 6. Insert new employee
      await prisma.employee.create({
        data: {
          empId,
          name,
          email,
          department,
          position
        }
      });

      inserted++;
    }

    // 7. Send response
    res.json({
      success: true,
      message: `Sync completed. Inserted: ${inserted}, Skipped (duplicates/missing): ${skipped}`
    });
  } catch (error) {
    console.error("Sync error:", error);
    throw new AppError("Failed to sync employees", 500);
  }
}
