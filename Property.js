import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getAuth, getIdToken } from 'firebase/auth';
import { Table, FloatingLabel, Button, TextInput, Select, Label, ListGroup, Spinner, Datepicker, Tooltip, ToggleSwitch, Modal} from 'flowbite-react';

let rowCounter = 0;
const PREDEFINED_REMINDERS = ['Gutter Cleaning', 'Furnace Servicing', 'Sewer Line Inspection', 'Annual Walkthrough'];


const PropertyDetail = () => {
  const [organizedData, setOrganizedData] = useState({});
  const [propertyAddress, setPropertyAddress] = useState(''); 
  const [autoBilling, setAutoBilling] = useState(null); 
  const [lateFee, setLateFee] = useState(null); 
  const [cityState, setCityState] = useState(''); 
  const [tableRows, setTableRows] = useState([]);
  const [latePolicyDay, setLatePolicyDay] = useState('');
  const [latePolicyTime, setLatePolicyTime] = useState('');
  const [lateFeeType, setLateFeeType] = useState('');
  const [fixedLateFee, setFixedLateFee] = useState('');
  const [percentLateFee, setPercentLateFee] = useState('');
  const [reoccuringLateFeeType, setReoccuringLateFeeType] = useState('');
  const [reoccuringFixedLateFee, setReoccuringFixedLateFee] = useState('');
  const [reoccuringPercentLateFee, setReoccuringPercentLateFee] = useState('');
  const [NSFLateFee, setNSFLateFee] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [maintenanceReminders, setMaintenanceReminders] = useState('');
  const [isRentIncreaseSuggestionsEnabled, setIsRentIncreaseSuggestionsEnabled] = useState(false);
  const [selectedReminders, setSelectedReminders] = useState([]);
  const [selectedDates, setSelectedDates] = useState({});
  const [newReminder, setNewReminder] = useState(''); 
  const [originalTableRows, setOriginalTableRows] = useState([]);
  const initialSettings = useRef({});
  const [generalData, setGeneralData] = useState({});
  const [propertyData, setPropertyData] = useState({});
  const initialSelectedDates = useRef({});
  const [propertyUid, setPropertyUid] = useState('');
  const { propertyId } = useParams();
  const [deletedUnits, setDeletedUnits] = useState([]);
  const location = useLocation();
  const fullString = location.state?.bucketInfo?.name;
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [isLateFeesModalOpen, setIsLateFeesModalOpen] = useState(false);
  const [isMaintanenceModalOpen, setIsMaintanenceModalOpen] = useState(false);
  const [currentProperty, setCurrentProperty] = useState(fullString);
  const [isLoading, setIsLoading] = useState(true);
  const [hasEdits, setHasEdits] = useState(false);
  const [switch1, setSwitch1] = useState(false);
  const [isLateFeeEnabled, setIsLateFeeEnabled] = useState(false);
  const [modalSize, setModalSize] = useState('3xl');
  const [reminders, setReminders] = useState(
    PREDEFINED_REMINDERS.reduce((acc, reminder) => ({ ...acc, [reminder]: [] }), {})
  ); 
  
  const navigate = useNavigate();

  const handlePropertyAddressChange = (event) => {
    setPropertyAddress(event.target.value);
  };

  const handleCityStateChange = (event) => {
    setCityState(event.target.value);
  };

  const handleAutoBillingSelection = (value) => {
      setAutoBilling(value);
  };

  const handleLatePolicyDayChange = (event) => {
    setLatePolicyDay(event.target.value);
  };

  const handleLatePolicyTimeChange = (event) => {
    setLatePolicyTime(event.target.value);
  };

  const handleRentIncreaseSuggestionsChange = (newValue) => {
      setIsRentIncreaseSuggestionsEnabled(newValue); 
  }; 
  
  const handleLateFeeOff = () => {
    setLateFee(false); 
    setLateFeeType("none"); 
    setIsLateFeeEnabled(false);
  };

  function ordinal(number) {
    const suffixes = ["th", "st", "nd", "rd"];
    const v = number % 100;
    return number + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
  }

  const formatCurrency = (value) => {
    let stringValue = String(value);
    let num = stringValue.replace(/[^\d.]/g, '');
    let [whole, decimal] = num.split('.');
    whole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    if (decimal?.length > 2) {
      decimal = decimal.substring(0, 2);
    }
    return `$${whole}` + (decimal !== undefined ? `.${decimal}` : '');
  };  

  const handleFixedLateFeeChange = (event) => {
      const formattedValue = formatCurrency(event.target.value.replace(/^\$/, ''));
      setFixedLateFee(formattedValue);
  };   

  const handleReoccuringFixedLateFeeChange = (event) => {
    const formattedValue = formatCurrency(event.target.value.replace(/^\$/, ''));
    setReoccuringFixedLateFee(formattedValue);
  }; 

  const handleNSFFeeChange = (event) => {
    const formattedValue = formatCurrency(event.target.value.replace(/^\$/, ''));
    setNSFLateFee(formattedValue);
  }; 

  const navigateToUnit = (unitID) => {
    navigate(`/unit/${unitID}/${propertyId}`);
  };
  
  // Handler for the percentage late fee input
  const handlePercentLateFeeChange = (event) => {
      setPercentLateFee(event.target.value);
  };

  const handlePercentChange = (e) => {
    let value = e.target.value;
    value = value.replace(/[^0-9]/g, '');
    const numericValue = Math.min(Math.max(parseInt(value, 10), 0), 100);
    setPercentLateFee(numericValue.toString());
  };

  const handleNumericInput = (e) => {
    // Allow only numeric values and some control keys
    if (!/[0-9]/.test(e.key) && e.key !== "Backspace" && e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== ".") {
        e.preventDefault();
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const date = new Date(dateStr);
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const PercentageSelector = ({ value, onChange }) => {
      const percentageOptions = Array.from({ length: 101 }, (_, i) => i);
      return (
        <Select 
            id="percentLateFee" 
            value={value}
            onChange={onChange}
            className='ml-3'
        >
            {percentageOptions.map((percent) => (
                <option key={percent} value={percent}>
                    {percent}%
                </option>
            ))}
        </Select>
      );
  };

  const handleReminderSelection = (reminder) => {
    setSelectedReminders((prev) => {
        if (prev.includes(reminder)) {
            // If the reminder is already selected, remove it and its date
            const nextSelectedReminders = prev.filter((item) => item !== reminder);
            setSelectedDates((prevDates) => {
                const nextSelectedDates = { ...prevDates };
                delete nextSelectedDates[reminder]; // Remove the date for this reminder
                return nextSelectedDates;
            });
            return nextSelectedReminders;
        } else {
            // If the reminder is not selected, add it
            return [...prev, reminder];
        }
    });
  };

  const handleDateChange = (date, reminderName) => {
    const dateString = (date instanceof Date) ? date.toISOString().split('T')[0] : date.split(' ')[0];
    setSelectedDates(prevDates => ({
        ...prevDates,
        [reminderName]: dateString
    }));
  };

  const addReminder = () => {
    if (newReminder && !selectedDates[newReminder]) {
      setSelectedDates(prevDates => ({
        ...prevDates,
        [newReminder]: '' 
      }));
      setNewReminder('');
    }
  };

  const removeReminder = (reminderToRemove) => {
    setSelectedDates(prevDates => {
      const newDates = { ...prevDates };
      delete newDates[reminderToRemove];
      return newDates;
    });
  }; 

  const handleLeaseExpirationChange = (newDate, index) => {
    const dateString = newDate ? newDate.toISOString().split('T')[0] : '';
    const updatedRows = [...tableRows];
    updatedRows[index] = { ...updatedRows[index], leaseExpiration: dateString };
    setTableRows(updatedRows);
  };

  function closeModalAndResetSettings(accepted = false) {
    setOpenModal(false); 
    setSwitch1(false); 
    setIsSettingsVisible(false); 
    handleSaveChanges();
  }

  const handleOpenLateFeesModal = (value) => {
    setIsLateFeesModalOpen(true); 
    setOpenModal(false);
    setLateFee(value);
  };

  const handleCloseLateFeesModal = () => {
    setIsLateFeesModalOpen(false); // Close the Late Fee Settings modal
    setOpenModal(true); // Ensure the Property Settings modal remains open
  };

  const handleSaveLateFeesModal = () => {
    setIsLateFeesModalOpen(false); // Close the Late Fee Settings modal
    setOpenModal(true); // Ensure the Property Settings modal remains open
    setIsLateFeeEnabled(true);
  };

  const handleOpenMaintenanceModal = () => {
    setIsMaintanenceModalOpen(true);
    setOpenModal(false);
    setMaintenanceReminders('yes');
  };

  const handleCloseMaintenanceModal = () => {
    setIsMaintanenceModalOpen(false);
    setOpenModal(true);
  }

  const handleSaveMaintenanceModal = () => {
    setIsMaintanenceModalOpen(false);
    setOpenModal(true);
  }

  const handleEditTableClick = () => {
    setIsEditMode(true); 
    setOpenModal(false); 
    setSwitch1(false); 
  };
  
  const handleRowChange = (event, index, key) => {
    const updatedValue = event.target.value || ''; 
    const updatedRows = [...tableRows];
    updatedRows[index] = { ...updatedRows[index], [key]: updatedValue };
    setTableRows(updatedRows);
  }; 

  const removeRow = (rowId) => {
    const deletedUnit = tableRows.find(row => row.id === rowId)?.unit;
    if (deletedUnit) {
      setDeletedUnits(prev => [...prev, deletedUnit]); 
      setHasEdits(true);
    }
    setTableRows(tableRows.filter(row => row.id !== rowId));
  }; 

  const addNewRow = () => {
    rowCounter += 1;
    setTableRows([...tableRows, { 
        id: rowCounter++, 
        unit: '', 
        beds: '1', 
        baths: '1', 
        rentAmount: '', 
        utilityRateSet: 'no', 
        utilityRateAmount: '', 
        sqft: '',
        leaseExpiration: '',
    }]);
  };

  const handleSaveChanges = async () => {
    const updatedRows = tableRows.filter((row, index) => {
      return JSON.stringify(row) !== JSON.stringify(originalTableRows[index]);
    });
  
    const updatedData = {};
    if (latePolicyDay !== initialSettings.current.latePolicyDay) {
      updatedData.latePolicyDay = latePolicyDay;
    }
    if (latePolicyTime !== initialSettings.current.latePolicyTime) {
      updatedData.latePolicyTime = latePolicyTime;
    }
    if (lateFeeType !== initialSettings.current.lateFeeType) {
      updatedData.lateFeeType = lateFeeType;
    }
    if (fixedLateFee !== initialSettings.current.fixedLateFee) {
      updatedData.fixedLateFee = fixedLateFee;
    }
    if (percentLateFee !== initialSettings.current.percentLateFee) {
      updatedData.percentLateFee = percentLateFee;
    }
    if (reoccuringLateFeeType !== initialSettings.current.reoccuringLateFeeType) {
      updatedData.reocurringLateFeeType = reoccuringLateFeeType;
    }
    if (reoccuringFixedLateFee !== initialSettings.current.reoccuringFixedLateFee) {
      updatedData.reoccuringFixedLateFee = reoccuringFixedLateFee;
    }
    if (reoccuringPercentLateFee !== initialSettings.current.reoccuringPercentLateFee) {
      updatedData.reoccuringPercentLateFee = reoccuringPercentLateFee;
    }
    if (NSFLateFee !== initialSettings.current.NSFLateFee) {
      updatedData.NSFLateFee = NSFLateFee;
    }
    if (propertyAddress !== initialSettings.current.propertyAddress) {
      updatedData.propertyAddress = propertyAddress;
    }
    if (cityState !== initialSettings.current.cityState) {
      updatedData.cityState = cityState;
    }
    if (JSON.stringify(selectedDates) !== JSON.stringify(initialSelectedDates.current)) {
      updatedData.selectedDates = selectedDates;
    }
    if ((autoBilling ? 'yes' : 'no') !== (initialSettings.current.autoBilling ? 'yes' : 'no')) {
      updatedData.autoBilling = autoBilling ? 'yes' : 'no';
    }
    if ((isRentIncreaseSuggestionsEnabled ? 'yes' : 'no') !== (initialSettings.current.rentIncreaseSuggestions ? 'yes' : 'no')) {
      updatedData.rentIncreaseSuggestions = isRentIncreaseSuggestionsEnabled ? 'yes' : 'no';
    }
    if (maintenanceReminders !== initialSettings.current.maintenanceReminders) {
      updatedData.maintenanceReminders = maintenanceReminders;
    }
    if (updatedRows.length > 0 || Object.keys(updatedData).length > 0 || hasEdits) {
      const dataToSend = {
        uid: propertyUid,
        propertyId: propertyId,
        units: updatedRows,
        deletedUnits,
        general: updatedData
      };

      console.log("we are sending: ", dataToSend);

      // Send data to backend
      try {
        const response = await fetch('http://localhost:3001/update-property-info', {
          method: 'POST', 
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(dataToSend)
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        } else {
          setDeletedUnits([]);
          console.log("Data successfully sent to backend");
        }
      } catch (error) {
        console.error("Error sending data to backend:", error);
      }
      // Update originalTableRows to reflect new changes
      setOriginalTableRows(tableRows);
    }
    // Exit edit mode after saving changes
    setHasEdits(false);
  };

  const updateCurrentProperty = (newPropertyString) => {
    setCurrentProperty(newPropertyString);
  };

  const handleToggleEditMode = () => {
      handleSaveChanges(); // Save changes if in edit mode
  }; 

  const updateTableData = () => {
    handleSaveChanges();
    setIsEditMode(false);
  };

  useEffect(() => {
    const fetchPropertyData = async () => {
      if (propertyId) {
        setIsLoading(true);
        try {
          const auth = getAuth();
          const user = auth.currentUser;

          if (!user) throw new Error("User not authenticated");

          const userToken = await getIdToken(user);
          const response = await fetch('http://localhost:3001/get-property-units', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${userToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ propertyId })
          });
      
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
          const data = await response.json();
          setIsLoading(false);

          console.log("our data: ", data);

          let parsedSelectedDates = {};
          if (data.SelectedDates && typeof data.SelectedDates === 'string') {
            try {
              parsedSelectedDates = JSON.parse(data.SelectedDates);
            } catch (error) {
              console.error("Error parsing SelectedDates:", error);
            }
          }

          // Handle possible null values with fallbacks
          setPropertyAddress(data.propertyAddress || '');
          setCityState(data.CityState || '');
          setAutoBilling(data.AutoBilling === 'yes');
          setLatePolicyDay(data.LatePolicyDay || '');
          setLatePolicyTime(data.LatePolicyTime || '');
          setLateFeeType(data.LateFeeType || '');
          setFixedLateFee(data.FixedLateFee || '');
          setPercentLateFee(data.PercentLateFee || '');
          setReoccuringLateFeeType(data.ReoccuringLateFeeType || '');
          setReoccuringFixedLateFee(data.ReoccuringFixedLateFee || '');
          setReoccuringPercentLateFee(data.ReoccuringPercentLateFee || '');
          setIsRentIncreaseSuggestionsEnabled(data.RentIncreaseSuggestions === 'yes');
          setMaintenanceReminders(data.MaintenanceReminders || '');
          setSelectedDates(parsedSelectedDates || '');
          setNSFLateFee(data.NSFLateFee || '');

          const formattedUnits = data.units.map((unit, index) => ({
            id: index,
            unitID: unit.UnitID, 
            unit: unit.UnitName,
            beds: unit.Beds?.toString() ?? '', 
            baths: unit.Baths?.toString() ?? '',
            rentAmount: unit.RentAmount ? unit.RentAmount.toString() : '',
            utilityRateSet: unit.UtilityRateSet ?? 'no',
            utilityRateAmount: unit.UtilityRateAmount ? unit.UtilityRateAmount.toString() : '',
            sqft: unit.Sqft ? unit.Sqft.toString() : '',
            leaseExpiration: unit.LeaseExpiration ? new Date(unit.LeaseExpiration).toISOString().split('T')[0] : '',
          }));
  
          setTableRows(formattedUnits);
          setOriginalTableRows(formattedUnits);

          initialSettings.current = {
            propertyAddress: data.propertyAddress,
            cityState: data.cityState,
            autoBilling: data.AutoBilling === 'yes',
            rentIncreaseSuggestions: data.RentIncreaseSuggestions === 'yes',
            maintenanceReminders: data.MaintenanceReminders || '',
            latePolicyDay: data.LatePolicyDay || '',
            latePolicyTime: data.LatePolicyTime || '',
            lateFeeType: data.LateFeeType || '',
            fixedLateFee: data.FixedLateFee || '',
            percentLateFee: data.PercentLateFee || '',
            reoccuringLateFeeType: data.ReoccuringLateFeeType || '',
            reoccuringFixedLateFee: data.ReoccuringFixedLateFee || '',
            reoccuringPercentLateFee: data.ReoccuringPercentLateFee || '',
            NSFLateFee: data.NSFLateFee || '',
            selectedDates: data.selectedDates || ''
          };

          console.log("Printing Reoccuring Type: ", initialSettings.reoccuringLateFeeType);

          console.log("Checking other value: ", initialSettings.autoBilling);

          setIsLateFeeEnabled(data.LateFeeType !== 'none');
  
          const combinedTableRows = [];

          // Iterate over each unit in the 'units' object
          Object.keys(data.units).forEach(unitKey => {
            const unit = data.units[unitKey];
            if (unit.tableRows) {
              // Filter the tableRows to include only those that match the current unit
              const filteredTableRows = unit.tableRows.filter(row => row.unit === unitKey);
              combinedTableRows.push(...filteredTableRows);
            }
          });
           
        } catch (error) {
          setIsLoading(false);
          console.error("Error fetching property data:", error);
        }
      }
    };
  
    fetchPropertyData();
  }, [propertyId]); // Dependencies array


  return (
    
    <div>

      {/* Loading Page Transition Display */}
      {isLoading && (
        <div className="absolute top-0 left-0 w-full h-full bg-gray-200 bg-opacity-50 flex justify-center items-center z-10">
          <Spinner color="success" aria-label="Success spinner example" />
        </div>
      )}

      {/* Table for displaying property data */}
      <div className="overflow-x-auto text-custom-color min-h-[800px]"> 
        <div className="overflow-x-auto flex justify-end items-center mt-36 md:mt-36 no-hover no-outline">
          </div>   

          <div className='pl-5 max-w-xs'> 
            <FloatingLabel
            variant="standard"
            value={propertyAddress}
            onChange={handlePropertyAddressChange}
            label="Property Address"
            disabled={!isEditMode}
            style={{ color: 'rgb(98, 85, 74)' }}
          
            />
            <FloatingLabel
              variant="standard"
              value={cityState}
              onChange={handleCityStateChange}
              label="City/State"
              disabled={!isEditMode}
              style={{ color: 'rgb(98, 85, 74)' }}
            /> 
          </div>

          {/* Late Fee Settings Modal Pop Up */}
          <Modal dismissible show={isLateFeesModalOpen} onClose={() => handleCloseLateFeesModal()} size={modalSize}>         

            <Modal.Header className="flex items-center justify-center relative">
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl md:text-3xl" style={{color: 'rgb(171, 143, 128)', fontFamily: "'Gill Sans','Gill Sans MT', 'Calibri,sans-serif'", fontWeight: '800'}}>
                  Late Fee Settings
                </span>
              </span>
            </Modal.Header>
            
            <Modal.Body className='flex items-center justify-center md:block md:ml-[55px]'>

            <div className='flex flex-col items-center md:block'>

              {/* Container for "Rent is late if not received by" and the time input */}
              <div className='flex mt-5 md:mb-4'>
                <div className='mr-3' style={{ color: 'rgb(98, 85, 74)' }}>
                  <FloatingLabel
                    variant="standard"
                    value="Rent is late by"
                    disabled={true}
                    className='w-[110px] md:w-[200px]'
                    style={{ color: 'rgb(98, 85, 74)' }}
                  />
                </div>
                <TextInput 
                  type="time"
                  id="latePolicyTime"
                  className="w-[90px] md:w-[106px]"
                  value={latePolicyTime}
                  onChange={handleLatePolicyTimeChange}
                  style={{color: 'rgb(98, 85, 74)', height: '40px'}}
                />
              
                {/* Container for day selection */}
                <div>
                  <div className='flex' style={{ color: 'rgb(98, 85, 74)' }}>
                    <Select 
                      id="latePolicyDay"
                      className="mx-2 ml-4 w-[75px]"
                      value={latePolicyDay}
                      onChange={handleLatePolicyDayChange}
                      style={{ color: 'rgb(98, 85, 74)' }}
                    >
                      <option value="">Select a day</option>
                      {[...Array(31).keys()].map(day => (
                          <option key={day + 1} value={day + 1}>{ordinal(day + 1)}</option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>

              {/* Late Fee Type Selection */}
              <div className='mt-4 flex items-center'>
                <div className='mb-4'>
                  <FloatingLabel
                    variant="standard"
                    value="Initial Late Fee"
                    disabled={true}
                    style={{ color: 'rgb(98, 85, 74)' }}
                    className='w-[110px] md:w-[200px]'
                  />
                </div>
                <div className='flex mb-4 ml-3'>
                  <Select
                    id="lateFeeType"
                    value={lateFeeType}
                    onChange={(e) => setLateFeeType(e.target.value)}
                    style={{ color: 'rgb(98, 85, 74)' }}
                    className='w-[100px] md:w-[180px]'
                  >
                    <option value="fixed">Fixed Amount</option>
                    <option value="percent">Percent of Past Due</option>
                    <option value="none">None</option>
                  </Select>

                  {lateFeeType === 'fixed' && (
                    <TextInput
                      value={formatCurrency(fixedLateFee)}
                      id="fixedLateFee"
                      placeholder="$"
                      onChange={handleFixedLateFeeChange}
                      onKeyDown={handleNumericInput}
                      style={{ width: '80px', color: 'rgb(98, 85, 74)' }}
                      className='ml-3'
                    />
                  )}

                  {lateFeeType === 'percent' && (
                    <PercentageSelector 
                      value={percentLateFee} 
                      id="percentLateFee"
                      onChange={(e) => setPercentLateFee(e.target.value)}
                      style={{color: 'rgb(98, 85, 74)', width:' 80px'}}
                      className='ml-3'
                    />
                  )}

                </div>
              </div>

              <div className='flex items-center'>
                <div className='mb-4'>
                    <FloatingLabel
                      variant="standard"
                      value="Accruing Late Fee"
                      disabled={true}
                      style={{ color: 'rgb(98, 85, 74)' }}
                      className='w-[110px] md:w-[200px]'
                    />
                </div>
                <div className='flex mb-4 ml-3'>
                  <Select
                    id="reoccuringLateFeeType"
                    value={reoccuringLateFeeType}
                    onChange={(e) => setReoccuringLateFeeType(e.target.value)}
                    style={{ color: 'rgb(98, 85, 74)' }}
                    className='w-[100px] md:w-[180px]'
                  >
                    <option value="fixed">Fixed Amount</option>
                    <option value="percent">Percent of Past Due</option>
                    <option value="none">None</option>
                  </Select>

                  {reoccuringLateFeeType === 'fixed' && (
                    <TextInput
                      value={formatCurrency(reoccuringFixedLateFee)}
                      id="reoccuringFixedLateFee"
                      placeholder="$"
                      onChange={handleReoccuringFixedLateFeeChange}
                      onKeyDown={handleNumericInput}
                      style={{ width: '80px', color: 'rgb(98, 85, 74)' }}
                      className='ml-3'
                    />
                  )}

                  {reoccuringLateFeeType === 'percent' && (
                    <PercentageSelector 
                      value={reoccuringPercentLateFee} 
                      id="reoccuringPercentLateFee"
                      onChange={(e) => setReoccuringPercentLateFee(e.target.value)}
                      style={{color: 'rgb(98, 85, 74)', width:' 80px'}}
                      className='ml-3'
                    />
                  )}

                </div>
              </div> 
              <div className='flex mb-4'>
                  <FloatingLabel
                    variant="standard"
                    value="NSF Fee"
                    disabled={true}
                    style={{ color: 'rgb(98, 85, 74)' }}
                    className='w-[100px] md:w-[200px]'
                  />
                   <TextInput
                      value={formatCurrency(NSFLateFee)}
                      id="NSFLateFee"
                      placeholder="$"
                      onChange={handleNSFFeeChange}
                      onKeyDown={handleNumericInput}
                      style={{ width: '80px', color: 'rgb(98, 85, 74)' }}
                      className='ml-3'
                    />
              </div>   
              </div>           
            </Modal.Body>

            <Modal.Footer className='flex justify-end md:block'>
              <Button 
                className='hover-bg-red md:ml-[445px]' 
                style={{backgroundColor:'rgb(171, 143, 128)', width:'90px'}} 
                onClick={() => handleSaveLateFeesModal()}>
                  Save
              </Button>
            </Modal.Footer>

          </Modal>

          {/* Maintenance Reminders Modal Pop-Up */}
          <Modal dismissible show={isMaintanenceModalOpen} onClose={() => handleCloseMaintenanceModal()} size={modalSize}>
            
            <Modal.Header>
              <span className='ml-20 md:ml-[100px] text-xl md:text-3xl' style={{color:'rgb(171, 143, 128)',  fontFamily: "'Gill Sans','Gill Sans MT', 'Calibri,sans-serif'", fontWeight: '800'}}>
                Maintenance Reminders
              </span>  
            </Modal.Header>
            
            <Modal.Body>
              {/* Maintenance Item List */}
              {maintenanceReminders === 'yes' && (
                <>
                  <div className="flex items-center justify-center">
                    <ListGroup className="bg-white-200 p-5 pb-1 border-none">
                      {Object.entries(selectedDates).map(([reminder, date], index) => (
                        <div key={index} className="flex mb-2" style={{color: 'rgb(98, 85, 74)'}}>
                            <div className="flex-grow mb-5">
                              <ListGroup.Item
                                style={{ outline: 'none' }}
                                className={maintenanceReminders === 'no' ? 'bg-gray-200 cursor-not-allowed' : 'max-w-[200px] overflow-hidden'} 
                                disabled={maintenanceReminders === 'no'}
                              >
                                {/* {reminder} */}
                                <FloatingLabel
                                  variant="standard"
                                  value={reminder} // Dynamically set the reminder text here
                                  onChange={(e) => { /* Handle the change if editable */ }}
                                  label="Reminder" // Set the label for your reminder
                                  disabled={true} // Only allow editing if conditions are met
                                  style={{ color: 'rgb(98, 85, 74)' }}
                                />
                              </ListGroup.Item>
                            </div>
                            <div className="flex items-center">
                              <Datepicker
                                name={reminder}
                                value={date || 'MM/DD/YYYY'}
                                onSelectedDateChanged={(newDate) => handleDateChange(newDate, reminder)}
                                style={{color: 'rgb(98, 85, 74)'}}
                                className='w-[130px]'
                              />
                              {/* Remove Button */}
                              <button
                                className="ml-2 text-red-500 mb-4"
                                onClick={() => removeReminder(reminder)}
                                style={{color: 'rgb(98, 85, 74)'}}
                              >
                                Remove
                              </button>
                            </div>
                        </div>
                      ))}
                    </ListGroup>
                  </div>

                  {/* Custom Maintenance Field Item */}
                  <div className="w-60 md:w-96 pl-0 md:pl-28">
                    <TextInput 
                        type="text" 
                        placeholder="Add Custom Reminder" 
                        value={newReminder}
                        onChange={(e) => setNewReminder(e.target.value)}
                        className={maintenanceReminders !== 'yes' ? 'bg-gray-200 cursor-not-allowed' : 'pb-2'}
                        style={{color: 'rgb(98, 85, 74)', width: '400px'}}
                    />
                    <Button
                        onClick={addReminder}
                        className={maintenanceReminders !== 'yes' ? 'opacity-50 cursor-not-allowed' : ''}
                        style={{ backgroundColor:'rgb(171, 143, 128)'}}
                    >
                        Add Reminder
                    </Button>
                  </div>

                </>
              )}
            </Modal.Body>
            
            <Modal.Footer>
              <Button 
                className='hover-bg-red ml-[405px] w-[100px] md:w-[110px]' 
                style={{backgroundColor:'rgb(171, 143, 128)'}} 
                onClick={() => handleSaveMaintenanceModal()}>
                  Save
              </Button>
            </Modal.Footer>

          </Modal>

          {/* Property Settings Modal Pop-Up */}
          <div>
          <Modal dismissible show={openModal} size={modalSize} onClose={() => closeModalAndResetSettings()}>
            
            <Modal.Header className="flex items-center justify-center relative">
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl md:text-3xl" style={{color: 'rgb(171, 143, 128)', fontFamily: "'Gill Sans','Gill Sans MT', 'Calibri,sans-serif'", fontWeight: '800'}}>
                  Property Settings
                </span>
              </span>
            </Modal.Header>

            <Modal.Body className='pb-0 flex items-center justify-center md:block md:pl-[115px] min-h-full w-full'>

            <div className='flex flex-col items-center md:block'>

              {/* Auto Billing Toggle */}
              <div className="pt-6 pb-1 flex items-center">
                <div className='flex'>
                  <div>
                    <FloatingLabel
                      variant="standard"
                      value="Auto Billing"
                      disabled={true}
                      style={{ color: 'rgb(98, 85, 74)' }}
                      className='w-[170px] md:w-[300px]'
                    />
                  </div>
                  <div className='flex-shrink-0 ml-4'>
                    <Button.Group>
                      <Button 
                        style={{
                          backgroundColor: autoBilling ? 'rgb(171, 143, 128)' : 'white', 
                          color: autoBilling ? 'white' : 'rgb(171, 143, 128)',
                          border: autoBilling ? 'none' : '1px solid rgb(171, 143, 128)',
                        }}
                        onClick={() => handleAutoBillingSelection(true)}
                      >
                        On
                      </Button>
                      <Button 
                        onClick={() => handleAutoBillingSelection(false)}
                        style={{
                          backgroundColor: !autoBilling ? 'rgb(171, 143, 128)' : 'white', 
                          color: !autoBilling ? 'white' : 'rgb(171, 143, 128)', 
                          border: !autoBilling ? 'none' : '1px solid rgb(171, 143, 128)',
                        }}
                      >
                        Off
                      </Button>
                    </Button.Group>
                  </div>
                </div>
              </div>

              {/* Late Fee Toggle */}
              {autoBilling && (
                <>
                  <div className="flex flex-col items-start mt-4 w-full">
                  <div className='flex items-center justify-center'>
                    <div> 
                      <FloatingLabel
                        variant="standard"
                        value="Late Fees"
                        disabled={true}
                        style={{ color: 'rgb(98, 85, 74)' }}
                        className='w-[170px] md:w-[300px]'
                      />
                    </div>
                    <div className='flex-shrink-0 ml-4 mb-4'>
                      <Button.Group>
                        <Button 
                          style={{
                            backgroundColor: isLateFeeEnabled ? 'rgb(171, 143, 128)' : 'white', 
                            color: isLateFeeEnabled ? 'white' : 'rgb(171, 143, 128)',
                            border: isLateFeeEnabled ? 'none' : '1px solid rgb(171, 143, 128)',
                          }}
                          onClick={() => handleOpenLateFeesModal(true)}
                        >
                          On
                        </Button>
                        <Button 
                          onClick={handleLateFeeOff}
                          style={{
                            backgroundColor: !isLateFeeEnabled ? 'rgb(171, 143, 128)' : 'white', 
                            color: !isLateFeeEnabled ? 'white' : 'rgb(171, 143, 128)', 
                            border: !isLateFeeEnabled ? 'none' : '1px solid rgb(171, 143, 128)',
                          }}
                        >
                          Off
                        </Button>
                      </Button.Group>
                    </div>
                  </div>
                </div>
                </>
              )}

              {/* Rent Increase Toggle */}
              <div className="pb-4 pt-4 flex">
                <div>
                  <FloatingLabel
                    variant="standard"
                    value="Rent Increase Suggestions"
                    style={{color: 'rgb(98, 85, 74)'}}
                    className='w-[170px] md:w-[300px]'
                    disabled={true}
                  />
                </div>
                <Button.Group className='ml-4 pb-6'>
                  <Button 
                    onClick= {() => handleRentIncreaseSuggestionsChange(true)}
                    style={{
                      backgroundColor: isRentIncreaseSuggestionsEnabled ? 'rgb(171, 143, 128)' : 'white', 
                      color: isRentIncreaseSuggestionsEnabled ? 'white' : 'rgb(171, 143, 128)',
                      border: isRentIncreaseSuggestionsEnabled ? 'none' : '1px solid rgb(171, 143, 128)',
                    }}
                  >
                    On
                  </Button>
                  <Button 
                    onClick={() => handleRentIncreaseSuggestionsChange(false)}
                    style={{
                      backgroundColor: !isRentIncreaseSuggestionsEnabled ? 'rgb(171, 143, 128)' : 'white', 
                      color: !isRentIncreaseSuggestionsEnabled ? 'white' : 'rgb(171, 143, 128)',
                      border: !isRentIncreaseSuggestionsEnabled ? 'none' : '1px solid rgb(171, 143, 128)',
                    }}
                  >
                    Off
                  </Button>
                </Button.Group>
              </div>

              {/* Maintenance Reminders Setting */}
              <div className='mb-3 flex'>
                <div>
                  <FloatingLabel
                    variant="standard"
                    value="Maintenance Reminders"
                    disabled={true}
                    style={{color: 'rgb(98, 85, 74)'}}
                    className='w-[170px] md:w-[300px]'
                  />
                </div>
                <Button.Group className='ml-4 mb-6'>
                  <Button
                    // onClick={() => setMaintenanceReminders('yes')}
                    onClick={() => handleOpenMaintenanceModal()}
                    onFocus={(e) => e.currentTarget.style.outline = 'none'}
                    onBlur={(e) => e.currentTarget.style.outline = ''}
                    style={{
                      backgroundColor: maintenanceReminders === 'yes' ? 'rgb(171, 143, 128)' : 'white', 
                      color: maintenanceReminders === 'yes' ? 'white' : 'rgb(171, 143, 128)',
                      border: maintenanceReminders === 'yes' ? 'none' : '1px solid rgb(171, 143, 128)',
                    }}
                  >
                    On
                  </Button>
                  <Button  
                    onClick={() => setMaintenanceReminders('no')}
                    onFocus={(e) => e.currentTarget.style.outline = 'none'}
                    onBlur={(e) => e.currentTarget.style.outline = ''}
                    style={{
                      backgroundColor: maintenanceReminders === 'no' ? 'rgb(171, 143, 128)' : 'white', 
                      color: maintenanceReminders === 'no' ? 'white' : 'rgb(171, 143, 128)',
                      border: maintenanceReminders === 'no' ? 'none' : '1px solid rgb(171, 143, 128)',
                    }}
                  >
                    Off
                  </Button>
                </Button.Group>
              </div>
              </div>

            </Modal.Body>

            <div className='flex items-end justify-end mr-[10px] md:mr-[95px]'>
              <Modal.Footer>
                  <Button className='hover-bg-red' style={{backgroundColor:'rgb(171, 143, 128)', width:'90px'}} onClick={() => closeModalAndResetSettings()}>Save</Button>
                  <Button style={{backgroundColor:'rgb(171, 143, 128)'}} onClick={handleEditTableClick}>Edit Table</Button>
              </Modal.Footer>
            </div>

          </Modal>
        </div>       

        {/* Unit Row Data */}
        <Table> 

          {/* Table Headers */}
          <Table.Head style={{ color: 'rgb(98, 85, 74)' }}>
            <Table.HeadCell>Unit</Table.HeadCell>
            <Table.HeadCell>Beds</Table.HeadCell>
            <Table.HeadCell>Baths</Table.HeadCell>
            <Table.HeadCell>Rent Amount</Table.HeadCell>
            <Table.HeadCell>Set Utility Rate</Table.HeadCell>
            <Table.HeadCell>Square Feet</Table.HeadCell>
            <Table.HeadCell>Lease Expiration</Table.HeadCell>
            <Table.HeadCell>AR Balance</Table.HeadCell>
            <Table.HeadCell><span className="sr-only">Edit</span></Table.HeadCell>
          </Table.Head>

          {/* Table Row Data */}
          <Table.Body className="divide-y" style={{ color: 'rgb(98, 85, 74)' }}>
            {tableRows.map((row, index) => (
              <Table.Row 
                
                // Nav Link to Unit Page
                key={index} 
                className="bg-white dark:border-gray-700 dark:bg-gray-800"
                onClick={() => {
                  if (!isEditMode) {
                    navigateToUnit(row.unitID);
                  }
                }}>

                {/* Unit */}
                <Table.Cell>
                  {isEditMode ? (
                    <TextInput
                      type="text"
                      value={row.unit}
                      onChange={(e) => handleRowChange(e, index, 'unit')}
                    />
                  ) : (
                    row.unit
                  )}
                </Table.Cell>

                {/* Beds */}
                <Table.Cell>
                  {isEditMode ? (
                    <Select 
                      aria-label="Bed" 
                      value={row.beds}
                      onChange={(e) => handleRowChange(e, index, 'beds')}
                    >
                      {[...Array(10).keys()].map(n => (
                        <option key={n} value={n + 1}>{n + 1} Bed</option>
                      ))}
                    </Select>
                  ) : (
                    row.beds
                  )}
                </Table.Cell>

                {/* Baths */}
                <Table.Cell>
                  {isEditMode ? (
                    <Select 
                      aria-label="Bath"
                      value={row.baths}
                      onChange={(e) => handleRowChange(e, index, 'baths')}
                    >
                      {[...Array(10).keys()].map(n => (
                        <option key={n} value={n + 1}>{n + 1} Bath</option>
                      ))}
                    </Select>
                  ) : (
                    row.baths
                  )}
                </Table.Cell>

                {/* Rent Amount */}
                <Table.Cell>
                  {isEditMode ? (
                    <TextInput
                      type="text"
                      value={row.rentAmount}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
                            handleRowChange({ target: { value: value } }, index, 'rentAmount');
                        }
                      }}
                    />
                  ) : (
                    row.rentAmount
                  )}
                </Table.Cell>

                {/* Set Utility Rate */}
                <Table.Cell>
                  {isEditMode ? (
                    <TextInput
                      type="text"
                      value={row.utilityRateAmount}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
                            handleRowChange({ target: { value: value } }, index, 'utilityRateAmount');
                        }
                      }}
                    />
                  ) : (
                    row.utilityRateAmount
                  )}
                </Table.Cell>

                {/* Square Feet */}
                <Table.Cell>
                  {isEditMode ? (
                    <TextInput
                      type="text"
                      value={row.sqft}
                      onChange={(e) => {
                        const numericValue = e.target.value.replace(/[^0-9]/g, '');
                        handleRowChange({ target: { value: numericValue } }, index, 'sqft');
                    }}
                    />
                  ) : (
                    row.sqft
                  )}
                </Table.Cell>

                {/* Lease Expiration */}
                <Table.Cell>
                  {isEditMode ? (
                    <Datepicker
                      value={row.leaseExpiration || 'MM/DD/YYYY'}
                      onSelectedDateChanged={(newDate) => handleLeaseExpirationChange(newDate, index)}
                      disabled={!isEditMode}
                      className='z-100'
                    />
                  ) : (
                    // row.leaseExpiration
                    formatDate(row.leaseExpiration)
                  )}
                </Table.Cell>

                <Table.Cell>
                    {/* AR balance data will go here */}
                </Table.Cell>

                {/* Remove Row Button */}
                <Table.Cell>
                  {isEditMode && (
                    <span 
                      style={{ textDecoration: "underline", color: 'rgb(171, 143, 128)', cursor: "pointer" }}
                      onClick={() => removeRow(row.id)}
                    >
                      Remove
                    </span>
                  )}
                </Table.Cell>
              </Table.Row>
            ))}
            {/* Placeholder Row for 'Add Row' Button - Appears in Edit Mode Only */}
            {isEditMode && (
              <Table.Row className="bg-white dark:border-gray-700 dark:bg-gray-800">
                <Table.Cell colSpan="100%" className="text-center"> 
                <div className='flex items-center justify-left'>
                  <Button 
                    onClick={addNewRow} 
                    style={{backgroundColor:'rgb(171, 143, 128)'}}
                  >
                    Add New Row
                  </Button>
                  <Button 
                    onClick={updateTableData} 
                    className='ml-4'
                    style={{backgroundColor:'rgb(171, 143, 128)'}}
                  >
                    Save
                  </Button>
                </div>
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
      </Table>

      {/* Settings Dropdown Button */}
      <div className='flex items-center pt-6 pl-6'>
            <ToggleSwitch 
                checked={switch1}
                onChange={(newCheckedValue) => {
                    setSwitch1(newCheckedValue); 
                    setIsSettingsVisible(prev => !prev);
                    setOpenModal(true);
                }}
                style={{
                  backgroundColor: switch1 ? 'rgb(171, 143, 128)' : 'white', 

                }}
            />
            <span className="dark:text-white mr-3 ml-4" style={{ color: 'rgb(98, 85, 74)' }}>Property Settings</span>
      </div>
    </div>
  </div>
  );
};

export default PropertyDetail;
