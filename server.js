const express = require('express');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');
const admin = require('firebase-admin');
const app = express();
const port = 3001;
const bodyParser = require('body-parser');
const mysql = require('mysql');
const fs = require('fs');

app.use(express.json()); // Middleware to parse JSON requests

app.use(cors());

// Use body parser middleware
app.use(bodyParser.json());

// Configure Google Cloud Storage
const storage = new Storage({ keyFilename: '../config/google-auth.json' });
const bucketName = 'property-info';
const allowedColumns = ['name', 'phone', 'email', 'lease_start_date'];

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(require('../config/firebase-auth.json')),
});

// Create a MySQL pool
const pool = mysql.createPool({
  host: '',
  port: '',
  user: '',
  password: '',
  database: '',

});

// Convert pool.getConnection to return a promise
const getConnection = () => {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) reject(err);
      else resolve(connection);
    });
  });
};

// Convert connection.query to return a promise
const query = (connection, query, parameters) => {
  return new Promise((resolve, reject) => {
    connection.query(query, parameters, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

// update general info for tenant
const updateGeneralInfo = async (propertyId, general) => {
  const updates = [];
  const values = []; 

  for (const [key, value] of Object.entries(general)) {
    if (['name', 'phone', 'email', 'lease_start_date'].includes(key)) {
      updates.push(`${key} = ?`); 
      values.push(value); 
    }
  }

  if (updates.length > 0) {
    // Add propertyId to the end of the values array for the WHERE clause
    values.push(propertyId);
    
    const query = `UPDATE properties SET ${updates.join(', ')} WHERE PropertyID = ?`;

    // Assuming db is your database connection object
    try {
      const result = await db.query(query, values);
      console.log(result);
      // Handle success (e.g., send a response back to the client)
    } catch (error) {
      console.error(error);
      // Handle error (e.g., send an error response back to the client)
    }
  }
};

const updateUnits = async (units, propertyId) => {
  units.forEach(async (unit) => {
    if (unit.id) {
      // Update existing unit
      const updates = [];
      for (const [key, value] of Object.entries(unit)) {
        if (key !== 'id') { // Exclude the id from the updates
          let sqlValue = typeof value === 'string' ? `'${value}'` : value;
          updates.push(`${key} = ${sqlValue}`);
        }
      }
      // Execute the query
      const query = `UPDATE units SET ${updates.join(', ')} WHERE UnitID = ${unit.id} AND PropertyID = ${propertyId}`;
    } else {
      // Add new unit
      const columns = Object.keys(unit).join(', ');
      const values = Object.values(unit).map(value => typeof value === 'string' ? `'${value}'` : value).join(', ');
      // Execute the query
      const query = `INSERT INTO units (PropertyID, ${columns}) VALUES (${propertyId}, ${values})`;
    }
  });
};

const deleteUnits = async (connection, deletedUnits, propertyId) => {
  for (const unit of deletedUnits) {
    try {
      // Including propertyId in the deletion criteria
      const query = `DELETE FROM units WHERE UnitName = ? AND PropertyID = ?`;
      const result = await connection.query(query, [unit, propertyId]);
    } catch (error) {
      console.error(`Error deleting unit ${unit} for propertyId ${propertyId}:`, error);
    }
  }
};

const deleteTenants = async (connection, deletedTenants, unitId) => {
  for (const tenantId of deletedTenants) {
    try {
      // Assuming TenantID is the correct column name and it's an integer
      const query = `DELETE FROM tenants WHERE TenantID = ? AND UnitID = ?`;
      const result = await connection.query(query, [tenantId, unitId]);
    } catch (error) {
      console.error(`Error deleting TenantID ${tenantId} for UnitID ${unitId}:`, error);
    }
  }
};

function toNullOrValue(value) {
  return (value === '' || value === undefined) ? null : value;
}

function toYYYYMMDD(dateStr) {
  if (!dateStr) {
      // Return null or '' if the dateStr is not provided or is an empty string
      return null;
  }
  // Handle date strings in the 'YYYY-MM-DD' format
  const matches = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (matches) {
      // If the input is already in 'YYYY-MM-DD' format, return it directly
      return dateStr;
  } else {
      // Fallback for 'MM/DD/YYYY' format if needed
      const [month, day, year] = dateStr.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
}

// Filter and map updateParts to ensure they only include allowed columns
const safeUpdateParts = updateParts
    .filter(part => allowedColumns.includes(part.columnName))
    .map(part => `${part.columnName} = ?`);

const updateValues = updateParts
    .filter(part => allowedColumns.includes(part.columnName))
    .map(part => part.value);


// Rest API for uploading add property client data and sending to Google Cloud MYSQL (AddProperty component)
app.post('/upload-property-info', async (req, res) => {
  try {
    const connection = await getConnection();
    const { uid, propertyAddress, cityState, autoBilling, rentIncreaseSuggestions, maintenanceReminders, invoicingSchedule, latePolicyDay, latePolicyTime, lateFeeType, fixedLateFee, percentLateFee, customLateFee, reoccuringLateFeeType, reoccuringFixedLateFee, reoccuringPercentLateFee, NSFLateFee, units, selectedDates  } = req.body;

    if (!uid) {
      return res.status(401).json({ status: 'error', message: 'UID not provided' });
    }

    const propertyQuery = 'INSERT INTO properties (UID, Address, CityState, AutoBilling, RentIncreaseSuggestions, MaintenanceReminders, InvoicingSchedule, LatePolicyDay, LatePolicyTime, LateFeeType, FixedLateFee, PercentLateFee, ReoccuringLateFeeType, ReoccuringFixedLateFee, ReoccuringPercentLateFee, NSFLateFee, SelectedDates) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const propertyValues = [
      uid, 
      propertyAddress, 
      cityState, 
      autoBilling || null, 
      rentIncreaseSuggestions || null, 
      maintenanceReminders || null, 
      parseInt(invoicingSchedule) || null,
      parseInt(latePolicyDay) || null,
      latePolicyTime || null,
      lateFeeType || null, 
      fixedLateFee ? parseFloat(fixedLateFee) : null, 
      percentLateFee ? parseFloat(percentLateFee) : null, 
      reoccuringLateFeeType || null,
      reoccuringFixedLateFee ? parseFloat(reoccuringFixedLateFee) : null, 
      reoccuringPercentLateFee ? parseFloat(reoccuringPercentLateFee) : null, 
      NSFLateFee ? parseFloat(NSFLateFee) : null,
      JSON.stringify(selectedDates) || null  
    ];

    const propertyResult = await query(connection, propertyQuery, propertyValues);
    const propertyId = propertyResult.insertId;

    for (const unitName in units) {
      const unitData = units[unitName];
      const unitValues = [
        propertyId, 
        unitName, 
        unitData.beds || null, 
        unitData.baths || null, 
        unitData.rentAmount || null, 
        unitData.utilityRateSet || null, 
        unitData.utilityRateAmount || null, 
        unitData.sqft || null, 
        unitData.leaseExpiration || null, 
        autoBilling || null, 
        rentIncreaseSuggestions || null, 
        maintenanceReminders || null, 
        parseInt(invoicingSchedule) || null,
        parseInt(latePolicyDay) || null,
        latePolicyTime || null,
        lateFeeType || null, 
        fixedLateFee ? parseFloat(fixedLateFee) : null, 
        percentLateFee ? parseFloat(percentLateFee) : null,  
        reoccuringLateFeeType || null,
        reoccuringFixedLateFee ? parseFloat(reoccuringFixedLateFee) : null, 
        reoccuringPercentLateFee ? parseFloat(reoccuringPercentLateFee) : null, 
        NSFLateFee ? parseFloat(NSFLateFee) : null,
   
      ];
      const unitQuery = 'INSERT INTO units (PropertyID, UnitName, Beds, Baths, RentAmount, UtilityRateSet, UtilityRateAmount, Sqft, LeaseExpiration, AutoBilling, RentIncreaseSuggestions, MaintenanceReminders, InvoicingSchedule, LatePolicyDay, LatePolicyTime, LateFeeType, FixedLateFee, PercentLateFee, ReoccuringLateFeeType, ReoccuringFixedLateFee, ReoccuringPercentLateFee, NSFLateFee) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
      await query(connection, unitQuery, unitValues);
    }

    connection.release();
    res.status(200).json({ status: 'success', message: 'Property and units data uploaded successfully' });

  } catch (error) {
    console.error('Error uploading to MySQL:', error);
    if (connection) connection.release();
    res.status(500).json({ status: 'error', message: 'Internal Server Error' });
  }
});

// Get all properties (used on MyProperties component)
app.post('/get-properties', async (req, res) => {
  try {
    const idToken = req.headers.authorization.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const connection = await getConnection();
    const queryResult = await query(connection, 'SELECT * FROM properties WHERE UID = ?', [uid]);
    connection.release();

    res.json(queryResult);
  } catch (error) {
    console.error('Error fetching properties:', error);
    if (connection) connection.release();
    res.status(500).json({ status: 'error', message: 'Internal Server Error' });
  }
});

// get property data and return it to Property.js
app.post('/get-property-units', async (req, res) => {
  let connection;
  try {
    const { propertyId } = req.body;

    if (!propertyId) {
      return res.status(400).json({ status: 'error', message: 'Property ID is required' });
    }

    connection = await getConnection();

    // Fetch property details
    const propertyQuery = 'SELECT UID, Address AS propertyAddress, CityState, AutoBilling, RentIncreaseSuggestions, MaintenanceReminders, InvoicingSchedule, LatePolicyDay, LatePolicyTime, LateFeeType, FixedLateFee, PercentLateFee, ReoccuringLateFeeType, ReoccuringFixedLateFee, ReoccuringPercentLateFee, NSFLateFee, SelectedDates FROM properties WHERE PropertyID = ?';
    const [propertyDetails] = await query(connection, propertyQuery, [propertyId]);

    // Check if property exists
    if (!propertyDetails) {
      return res.status(404).json({ status: 'error', message: 'Property not found' });
    }

    // Fetch units for the property
    const unitsQuery = 'SELECT UnitID, UnitName, Beds, Baths, RentAmount, UtilityRateSet, UtilityRateAmount, Sqft, LeaseExpiration FROM units WHERE PropertyID = ?';
    const units = await query(connection, unitsQuery, [propertyId]);

    // Combine property details with units
    const responseData = {
      ...propertyDetails,
      units: units
    };

    res.json(responseData);
  } catch (error) {
    console.error('Error fetching property and unit data:', error);
    if (connection) connection.release();
    res.status(500).json({ status: 'error', message: 'Internal Server Error' });
  } finally {
    if (connection) connection.release();
  }
});

app.post('/update-property-info', async (req, res) => {
  let connection;
  try {
    const { uid, propertyId, units, general, deletedUnits } = req.body;

    connection = await getConnection();

    console.log("Our data: ", req.body);

    // Update general property info
    if (general && Object.keys(general).length > 0) {
      let updateQuery = 'UPDATE properties SET ';
      const params = [];
      let updateFields = [];

      // Explicitly map and append general fields to the update query
      if (general.propertyAddress !== undefined) {
        updateFields.push("Address = ?"); 
        params.push(general.propertyAddress);
      }
      if (general.cityState !== undefined) {
          updateFields.push("CityState = ?"); 
          params.push(general.cityState);
      }
      if (general.autoBilling !== undefined) {
        updateFields.push("AutoBilling = ?");
        params.push(general.autoBilling);
      }
      if (general.rentIncreaseSuggestions !== undefined) {
        updateFields.push("RentIncreaseSuggestions = ?");
        params.push(general.rentIncreaseSuggestions);
      }
      if (general.maintenanceReminders !== undefined) {
        updateFields.push("MaintenanceReminders = ?");
        params.push(general.maintenanceReminders);
      }
      if (general.latePolicyDay !== undefined) {
        updateFields.push("LatePolicyDay = ?");
        params.push(general.latePolicyDay);
      }
      if (general.latePolicyTime !== undefined) {
        updateFields.push("LatePolicyTime = ?");
        params.push(general.latePolicyTime);
      }
      if (general.lateFeeType !== undefined) {
        updateFields.push("LateFeeType = ?");
        params.push(general.lateFeeType);
      }
      if (general.fixedLateFee !== undefined) {
        const numericFixedLateFee = general.fixedLateFee.replace(/[^0-9.-]+/g, '');
        updateFields.push("FixedLateFee = ?");
        params.push(numericFixedLateFee);
      }
      if (general.percentLateFee !== undefined) {
        updateFields.push("PercentLateFee = ?");
        params.push(general.percentLateFee);
      }    
      if (general.reocurringLateFeeType !== undefined) {
        updateFields.push("ReoccuringLateFeeType = ?");
        params.push(general.reocurringLateFeeType);
      }
      if (general.reoccuringFixedLateFee !== undefined) {
        const numericReoccuringFixedLateFee = general.reoccuringFixedLateFee.replace(/[^0-9.-]+/g, '');
        updateFields.push("ReoccuringFixedLateFee = ?");
        params.push(numericReoccuringFixedLateFee);
      }
      if (general.reoccuringPercentLateFee !== undefined) {
        updateFields.push("ReoccuringPercentLateFee = ?");
        params.push(general.reoccuringPercentLateFee);
      }
      if (general.NSFLateFee !== undefined) {
        const numericNSFLateFee = general.NSFLateFee.replace(/[^0-9.-]+/g, '');
        updateFields.push("NSFLateFee = ?");
        params.push(numericNSFLateFee);
      }
      if (general.selectedDates !== undefined) {
        updateFields.push("SelectedDates = ?");
        params.push(JSON.stringify(general.selectedDates)); 
      }

      // Only proceed if there are fields to update
      if (updateFields.length > 0) {       
        updateQuery += updateFields.join(", ") + ` WHERE PropertyID = ?`;
        params.push(propertyId);

        await query(connection, updateQuery, params);
      } else {
          console.log("No valid fields found for update.");
      }
    } else {
      console.log("No general info provided for update.");
    }

    // Fetch property settings to use as defaults for unit fields
    const propertySettingsQuery = `
      SELECT AutoBilling, RentIncreaseSuggestions, MaintenanceReminders, 
            InvoicingSchedule, LatePolicyTime, LatePolicyDay, 
            LateFeeType, FixedLateFee, PercentLateFee, ReoccuringLateFeeType, 
            ReoccuringFixedLateFee, ReoccuringPercentLateFee, NSFLateFee, SelectedDates
      FROM properties 
      WHERE PropertyID = ?`;

    const propertySettings = await query(connection, propertySettingsQuery, [propertyId]);
    const defaultSettings = propertySettings.length > 0 ? propertySettings[0] : {};

    // Process each unit update or insert
    if (Array.isArray(units) && units.length > 0 || general) {
      console.log("We are in units....")
      await Promise.all(units.map(async (unit) => {
        const insertOrUpdateQuery = `
          INSERT INTO units (PropertyID, UnitName, Beds, Baths, RentAmount, UtilityRateSet, UtilityRateAmount, Sqft, LeaseExpiration, AutoBilling, RentIncreaseSuggestions, MaintenanceReminders, InvoicingSchedule, LatePolicyDay, LatePolicyTime, LateFeeType, FixedLateFee, PercentLateFee, ReoccuringLateFeeType, ReoccuringFixedLateFee, ReoccuringPercentLateFee, NSFLateFee)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          Beds = VALUES(Beds),
          Baths = VALUES(Baths),
          RentAmount = VALUES(RentAmount),
          UtilityRateSet = VALUES(UtilityRateSet),
          UtilityRateAmount = VALUES(UtilityRateAmount),
          Sqft = VALUES(Sqft),
          LeaseExpiration = VALUES(LeaseExpiration), 
          AutoBilling = VALUES(AutoBilling),
          RentIncreaseSuggestions = VALUES(RentIncreaseSuggestions),
          MaintenanceReminders = VALUES(MaintenanceReminders),
          InvoicingSchedule = VALUES(InvoicingSchedule),
          LatePolicyDay = VALUES(LatePolicyDay),
          LatePolicyTime = VALUES(LatePolicyTime),
          LateFeeType = VALUES(LateFeeType),
          FixedLateFee = VALUES(FixedLateFee),
          PercentLateFee = VALUES(PercentLateFee),
          ReoccuringLateFeeType = VALUES(ReoccuringLateFeeType), 
          ReoccuringFixedLateFee = VALUES(ReoccuringFixedLateFee), 
          ReoccuringPercentLateFee = VALUES(ReoccuringPercentLateFee),
          NSFLateFee = VALUES(NSFLateFee)
        `;
        const values = [
          propertyId, 
          unit.unit, 
          toNullOrValue(unit.beds),
          toNullOrValue(unit.baths),
          toNullOrValue(unit.rentAmount),
          toNullOrValue(unit.utilityRateSet),
          toNullOrValue(unit.utilityRateAmount),
          toNullOrValue(unit.sqft),
          toNullOrValue(unit.leaseExpiration),
          toNullOrValue(defaultSettings.AutoBilling),
          toNullOrValue(defaultSettings.RentIncreaseSuggestions),
          toNullOrValue(defaultSettings.MaintenanceReminders),
          toNullOrValue(defaultSettings.InvoicingSchedule),
          toNullOrValue(defaultSettings.LatePolicyDay),
          toNullOrValue(defaultSettings.LatePolicyTime),
          toNullOrValue(defaultSettings.LateFeeType),
          toNullOrValue(defaultSettings.FixedLateFee),
          toNullOrValue(defaultSettings.PercentLateFee),
          toNullOrValue(defaultSettings.ReoccuringLateFeeType),
          toNullOrValue(defaultSettings.ReoccuringFixedLateFee),
          toNullOrValue(defaultSettings.ReoccuringPercentLateFee),
          toNullOrValue(defaultSettings.NSFLateFee),
        ];

        // Execute the insert or update query
        const result = await query(connection, insertOrUpdateQuery, values);
      }));
    }

    // Delete specified units
    if (Array.isArray(deletedUnits) && deletedUnits.length > 0) {
      await deleteUnits(connection, deletedUnits, propertyId);
    }

    connection.release();
    res.status(200).json({ status: 'success', message: 'Property and units data updated successfully' });
  } catch (error) {
    console.error('Error updating property info:', error);
    if (connection) connection.release();
    res.status(500).json({ status: 'error', message: 'Internal Server Error' });
  }
});

app.post('/get-tenant-info', async (req, res) => {
  let connection;
  try {
    const { unitID, propertyId } = req.body;

    if (!unitNumber || !propertyId) {
      return res.status(400).json({ status: 'error', message: 'Unit number and property ID are required' });
    }

    connection = await getConnection();

    // Fetch general unit and property settings
    const generalSettingsQuery = `
    SELECT
        units.LeaseExpiration,
        units.AutoBilling,
        units.RentIncreaseSuggestions,
        units.LateFeeAmount,
        units.LatePolicyTime,
        units.LatePolicyDay,
        units.LateFeeType,
        units.FixedLateFee,
        units.PercentLateFee,
        units.ReoccuringLateFeeType,
        units.ReoccuringFixedLateFee,
        units.ReoccuringPercentLateFee,
        units.NSFLateFee,
        units.MaintenanceReminders,
        units.InvoicingSchedule,
        properties.Address AS PropertyAddress,
        properties.CityState AS PropertyCityState
    FROM units
    JOIN properties ON units.PropertyID = properties.PropertyID
    WHERE units.UnitID = ? AND units.PropertyID = ?
    LIMIT 1
    `;

    // Note that you will now pass unitID directly to your query parameters
    const generalSettingsResults = await query(connection, generalSettingsQuery, [unitID, propertyId]);

    if (generalSettingsResults.length === 0) {
      return res.status(404).json({ status: 'error', message: 'No general settings found for the specified unit number and property ID' });
    }

    const generalSettings = generalSettingsResults[0];

    // Fetch tenant-specific data
    const tenantsQuery = `
    SELECT
        TenantID,  
        Name AS TenantName,
        Email AS TenantEmail,
        Phone AS TenantPhone,
        LeaseStartDate
    FROM tenants
    WHERE UnitID = ?
    `;

    const tenantResults = await query(connection, tenantsQuery, [unitID]);
    
    // Combine the results
    const responseData = {
      ...generalSettings, // Spread general settings
      tenants: tenantResults // Nest tenant-specific data under 'tenants'
    };

    res.json({ status: 'success', data: responseData });
  } catch (error) {
    console.error('Error fetching tenant info:', error);
    res.status(500).json({ status: 'error', message: 'Internal Server Error' });
  } finally {
    if (connection) connection.release();
  }
});


// Updating Tenant Info Changes to Tenant Subfolder on Unit.js component
app.post('/update-tenant-info', async (req, res) => {
  let connection;
  try {
    const { unitId, propertyId, unitGeneral, tenants, deletedUnits } = req.body;

    connection = await getConnection();

    let updateParts = [];
    let queryValues = [];

    // Iterate over each key in unitGeneral to build the SQL update string and values array dynamically
    Object.keys(unitGeneral).forEach(key => {
      let dbFieldName = key; 

      // Add the SQL update part only if the value is not undefined
      if (unitGeneral[key] !== undefined) {
        updateParts.push(`${dbFieldName} = ?`);
        queryValues.push(toNullOrValue(unitGeneral[key]));
      }
    });

    // Add the unitId and propertyId to the query values array
    queryValues.push(unitId, propertyId);

    // Only proceed if there are fields to update 
    if (safeUpdateParts.length > 0) {
      const updateUnitGeneralQuery = `
          UPDATE units
          SET ${safeUpdateParts.join(', ')}
          WHERE UnitID = ? AND PropertyID = ?;
      `;
  
      // Append UnitID and PropertyID to the values array
      updateValues.push(UnitID, PropertyID);
  
      // Execute your parameterized query with the values array
      // Assuming you have a database query function available
      db.query(updateUnitGeneralQuery, updateValues, (error, results) => {
          if (error) throw error;
          // Handle your results here
          console.log(results);
      });
    }
      
      // Execute the dynamically constructed query with the values
      try {
        await query(connection, updateUnitGeneralQuery, queryValues);
        // Handle success
      } catch (error) {
        // Handle error
        console.error('Error updating unit and tenant info:', error);
      }


    if (Array.isArray(tenants) && tenants.length > 0) {
      await Promise.all(tenants.map(async (tenant) => {
        let insertOrUpdateTenantQuery = `
          INSERT INTO tenants (UnitID, Name, Email, Phone, LeaseStartDate)
          VALUES (?, ?, ?, ?, ?)
        `;
    
        if (tenant.tenantId) {
          insertOrUpdateTenantQuery += `
            ON DUPLICATE KEY UPDATE
            Name = VALUES(Name), Email = VALUES(Email), Phone = VALUES(Phone), LeaseStartDate = VALUES(LeaseStartDate);
          `;
        }
    
        const reformattedMoveInDate = toYYYYMMDD(tenant.moveInDate);
        let values = [
          unitId,
          tenant.tenant,
          tenant.email,
          tenant.phone,
          reformattedMoveInDate
        ];
    
        // If tenantId is provided, prepend it to values for the ON DUPLICATE KEY UPDATE case
        if (tenant.tenantId) {
          values.unshift(tenant.tenantId);
          // Adjust the query to include TenantID in the INSERT part
          insertOrUpdateTenantQuery = insertOrUpdateTenantQuery.replace('INSERT INTO tenants (UnitID,', 'INSERT INTO tenants (TenantID, UnitID,');
        }
    
        await query(connection, insertOrUpdateTenantQuery, values);
      }));
    }

    if (Array.isArray(deletedUnits) && deletedUnits.length > 0) {
      await deleteTenants(connection, deletedUnits, unitId);
    }

    res.status(200).json({ status: 'success', message: 'Unit and tenant information updated successfully.' });
  } catch (error) {
    console.error('Error updating unit and tenant info:', error);
    res.status(500).json({ status: 'error', message: 'Internal Server Error' });
  } finally {
    if (connection) connection.release();
  }
});


// User Info Retrieval via Firebase on Login
app.post('/get-user-info', async (req, res) => {
  const uid = req.body.uid;
  res.json({ uid: uid });
});

const printTableData = async (tableName) => {
    try {
      const connection = await getConnection();
      const queryResult = await query(connection, `SELECT * FROM ${tableName};`);
      console.log(`Data from ${tableName}:`);
      console.log(queryResult);
      connection.release();
    } catch (error) {
      console.error(`Error fetching data from ${tableName}:`, error);
    }
  };
  printTableData('properties');
  printTableData('units');
  printTableData('tenants');

// Clear MYSQL Table of Data
const deleteAllDataFromTable = async (tableName) => {
  try {
    const connection = await getConnection();
    await query(connection, `DELETE FROM ${tableName};`);
    console.log(`All data from ${tableName} has been deleted.`);
    connection.release();
  } catch (error) {
    console.error(`Error deleting data from ${tableName}:`, error);
  }
};
// deleteAllDataFromTable('tenants');
// deleteAllDataFromTable('units');
// deleteAllDataFromTable('properties');


app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});