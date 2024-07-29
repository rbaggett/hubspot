const bent = require("bent");
const constants = require("./hubspot.constants");

// {
//   "results": [
//     {
//       "customerId": 123,
//       "date": "2024-02-07",
//       "maxConcurrentCalls": 1,
//       "timestamp": 1707314726000,
//       "callIds": [
//         "2c269d25-deb9-42cf-927c-543112f7a76b"
//       ]
//     }
//   ]
// }

module.exports.run = () => {
  (async () => {
    let data = await getData();
    let customerMap = buildCustomerMap(data);
    let customerDateMap = buildCustomerDateMap(customerMap, data);
    let answer = buildResults(customerDateMap);
    let response = await postData(answer);
  })();
};

const buildCustomerMap = ({ callRecords }) => {
  let customers = new Map(
    callRecords.map((record) => [record.customerId, new Map()])
  );
  return customers;
};

const buildCustomerDateMap = (customerMap, { callRecords }) => {
  callRecords.map(({ callId, customerId, startTimestamp, endTimestamp }) => {
    let dates = customerMap.get(customerId);

    let date1 = new Date(startTimestamp).toDateString();
    let date2 = new Date(endTimestamp).toDateString();

    if (date1 === date2) {
      if (dates.has(date1)) {
        dates
          .get(date1)
          .push({ callId, customerId, startTimestamp, endTimestamp });
      } else {
        dates.set(date1, [
          { callId, customerId, startTimestamp, endTimestamp },
        ]);
      }
    } else {
      if (dates.has(date2)) {
        dates
          .get(date2)
          .push({ callId, customerId, startTimestamp, endTimestamp });
      } else {
        dates.set(date2, [
          { callId, customerId, startTimestamp, endTimestamp },
        ]);
      }
    }
  });

  customerMap.forEach((customerMap) => {
    customerMap.forEach((date) => {
      date.sort(
        (a, b) =>
          a.startTimestamp - b.startTimestamp || a.endTimestamp - b.endTimestamp
      );

      let previousTimestamp = undefined;
      date.maxConcurrentCalls = 0;
      date.forEach((call) => {
        if (previousTimestamp === undefined) {
          previousTimestamp = call.endTimestamp;
          return;
        }

        if (previousTimestamp > call.startTimestamp) {
          date.maxConcurrentCalls += 1;
        }
        previousDate = date;
      });
    });
  });

  return customerMap;
};

const buildResults = (customerDateMap) => {
  let answer = { results: [] };

  customerDateMap.forEach((dates, key, _) => {
    let sortedDates = [...dates].sort(
      (a, b) => a.maxConcurrentCalls - b.maxConcurrentCalls
    );
    let callIds = [];
    sortedDates.forEach((date) => {
      date[1].forEach((d) => callIds.push(d.callId));
    });
    let date = sortedDates[0];

    answer.results.push({
      customerId: date[1][0].customerId,
      date: date[0],
      maxConcurrentCalls: date[1].maxConcurrentCalls,
      timestamp: date[1][0].startTimestamp,
      callIds,
    });
  });
  return answer;
};

const getData = async () => {
  const stream = bent("GET", "json");
  return await stream(constants.GET_URL);
};

const postData = async (answer) => {
  const stream = bent("POST", "json", 200);
  return await stream(constants.POST_URL, answer);
};
