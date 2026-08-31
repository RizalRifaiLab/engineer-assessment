import type {
  CodingQuestion,
  McqQuestion,
  Question,
  Section,
  SqlQuestion,
} from "./types";

export const ASSESSMENT = {
  title: "Software Engineer Assessment",
  timeLimitMinutes: 45,
  passingPercent: 60,
};

export const SECTIONS: Section[] = [
  {
    id: "mcq",
    title: "Knowledge Quiz",
    description: "Multiple choice covering SQL, logic and core engineering concepts.",
  },
  {
    id: "coding",
    title: "Live Coding",
    description:
      "Pick your language — JavaScript, Python, C++, or Java — and write a function. Your code is run against hidden test cases.",
  },
  {
    id: "sql",
    title: "SQL",
    description:
      "Write SQL queries for the given schemas and run them against sample data. These are reviewed manually by your recruiter.",
  },
];

const MCQ_QUESTIONS: McqQuestion[] = [
  {
    kind: "mcq",
    id: "mcq-sql-1",
    category: "sql",
    prompt: "Which clause filters rows AFTER a GROUP BY aggregation has been applied?",
    options: ["WHERE", "HAVING", "ORDER BY", "LIMIT"],
    correctIndex: 1,
    explanation:
      "WHERE filters rows before grouping; HAVING filters groups after aggregation.",
    points: 2,
  },
  {
    kind: "mcq",
    id: "mcq-sql-2",
    category: "sql",
    prompt:
      "Which JOIN returns all rows from the left table plus matching rows from the right table, using NULL for non-matches?",
    options: ["LEFT JOIN", "INNER JOIN", "CROSS JOIN", "NATURAL JOIN"],
    correctIndex: 0,
    explanation:
      "LEFT (OUTER) JOIN keeps every left row and fills missing right columns with NULL.",
    points: 2,
  },
  {
    kind: "mcq",
    id: "mcq-sql-3",
    category: "sql",
    prompt: "What does an index in a relational database primarily improve?",
    options: [
      "Write (INSERT/UPDATE) performance",
      "Read (SELECT) performance",
      "Storage size",
      "Referential integrity",
    ],
    correctIndex: 1,
    explanation:
      "Indexes speed up lookups and reads at the cost of slightly slower writes and extra storage.",
    points: 2,
  },
  {
    kind: "mcq",
    id: "mcq-sql-4",
    category: "sql",
    prompt:
      "Given the query below, what does COUNT(*) count?\n\nSELECT department, COUNT(*) FROM employees GROUP BY department;",
    options: [
      "Distinct departments",
      "The number of rows in each department",
      "The number of columns",
      "All rows in the table regardless of grouping",
    ],
    correctIndex: 1,
    explanation:
      "With GROUP BY, COUNT(*) counts rows within each group (department).",
    points: 2,
  },
  {
    kind: "mcq",
    id: "mcq-sql-5",
    category: "sql",
    prompt: "Which statement removes all rows from a table while keeping the table structure?",
    options: ["DROP TABLE", "DELETE FROM table", "TRUNCATE TABLE", "REMOVE FROM table"],
    correctIndex: 2,
    explanation:
      "TRUNCATE removes all rows quickly and keeps the schema; DELETE removes rows row-by-row.",
    points: 2,
  },
  {
    kind: "mcq",
    id: "mcq-logic-1",
    category: "logic",
    prompt: "What is the time complexity of binary search on a sorted array of n elements?",
    options: ["O(n)", "O(n log n)", "O(log n)", "O(1)"],
    correctIndex: 2,
    explanation:
      "Binary search halves the search space each step, giving O(log n).",
    points: 2,
  },
  {
    kind: "mcq",
    id: "mcq-logic-2",
    category: "logic",
    prompt: "A function that calls itself to solve smaller instances of the same problem is called:",
    options: ["Iteration", "Recursion", "Memoization", "Composition"],
    correctIndex: 1,
    explanation: "Recursion is a function invoking itself on a reduced problem.",
    points: 2,
  },
  {
    kind: "mcq",
    id: "mcq-logic-3",
    category: "logic",
    prompt: "A stack data structure follows which ordering?",
    options: ["FIFO (first in, first out)", "LIFO (last in, first out)", "Random", "Sorted"],
    correctIndex: 1,
    explanation: "Stacks are LIFO: the most recently pushed item is popped first.",
    points: 2,
  },
  {
    kind: "mcq",
    id: "mcq-logic-4",
    category: "logic",
    prompt:
      "You need to repeatedly insert and remove elements from BOTH ends of a collection. Which structure fits best?",
    options: ["Stack", "Queue", "Deque (double-ended queue)", "Min-heap"],
    correctIndex: 2,
    explanation: "A deque supports O(1) insert/remove at both ends.",
    points: 2,
  },
  {
    kind: "mcq",
    id: "mcq-coding-1",
    category: "coding",
    prompt: "In JavaScript, what does the `===` operator compare?",
    options: [
      "Value only",
      "Value and type",
      "Reference identity only",
      "Nothing; it always returns false",
    ],
    correctIndex: 1,
    explanation: "Strict equality compares both value and type without coercion.",
    points: 2,
  },
  {
    kind: "mcq",
    id: "mcq-coding-2",
    category: "coding",
    prompt: "What is the result of `typeof null` in JavaScript?",
    options: ['"null"', '"undefined"', '"object"', '"number"'],
    correctIndex: 2,
    explanation: "A historical quirk: typeof null returns \"object\".",
    points: 2,
  },
  {
    kind: "mcq",
    id: "mcq-coding-3",
    category: "coding",
    prompt: "Which HTTP method is idempotent and conventionally used to retrieve a resource?",
    options: ["POST", "GET", "PATCH", "PUT"],
    correctIndex: 1,
    explanation: "GET is safe and idempotent — it retrieves without side effects.",
    points: 2,
  },
];

const CODING_QUESTIONS: CodingQuestion[] = [
  {
    kind: "coding",
    id: "code-1",
    title: "Reverse a String",
    difficulty: "Easy",
    prompt:
      "Write a function `solve(str)` that returns the input string reversed.\n\nExamples:\n  solve(\"hello\")  -> \"olleh\"\n  solve(\"\")       -> \"\"\n  solve(\"ab\")     -> \"ba\"",
    languages: [
      {
        language: "javascript",
        label: "JavaScript (Node)",
        signature: "solve(str)",
        starterCode: "function solve(str) {\n  // your code here\n}",
      },
      {
        language: "python",
        label: "Python 3",
        signature: "def solve(s):",
        starterCode: "def solve(s):\n    # your code here\n    return s",
      },
      {
        language: "cpp",
        label: "C++ (GCC 14)",
        signature: "string solve(string str)",
        starterCode: [
          "#include <bits/stdc++.h>",
          "using namespace std;",
          "",
          "string solve(string str) {",
          "    // your code here",
          "    return str;",
          "}",
        ].join("\n"),
      },
      {
        language: "java",
        label: "Java (JDK 17)",
        signature: "static String solve(String str)",
        starterCode: [
          "static String solve(String str) {",
          "    // your code here",
          "    return str;",
          "}",
        ].join("\n"),
      },
    ],
    examples: [
      { args: ["hello"], expected: "olleh" },
      { args: [""], expected: "" },
    ],
    testCases: [
      { args: ["hello"], expected: "olleh" },
      { args: [""], expected: "" },
      { args: ["a"], expected: "a" },
      { args: ["OpenAI"], expected: "IAnepO" },
      { args: ["12345"], expected: "54321" },
    ],
    points: 8,
  },
  {
    kind: "coding",
    id: "code-2",
    title: "Two Sum",
    difficulty: "Medium",
    prompt:
      "Given an array of integers `nums` and an integer `target`, write a function `solve(nums, target)` that returns the indices of the two numbers that add up to `target` as an array `[i, j]`. Assume exactly one solution exists and you may not use the same element twice.\n\nExamples:\n  solve([2,7,11,15], 9) -> [0,1]\n  solve([3,2,4], 6)      -> [1,2]\n  solve([3,3], 6)        -> [0,1]",
    languages: [
      {
        language: "javascript",
        label: "JavaScript (Node)",
        signature: "solve(nums, target)",
        starterCode: "function solve(nums, target) {\n  // your code here\n  return [0, 0];\n}",
      },
      {
        language: "python",
        label: "Python 3",
        signature: "def solve(nums, target):",
        starterCode: "def solve(nums, target):\n    # your code here\n    return [0, 0]",
      },
      {
        language: "cpp",
        label: "C++ (GCC 14)",
        signature: "vector<int> solve(const vector<int>& nums, int target)",
        starterCode: [
          "#include <bits/stdc++.h>",
          "using namespace std;",
          "",
          "vector<int> solve(const vector<int>& nums, int target) {",
          "    // your code here",
          "    return {0, 0};",
          "}",
        ].join("\n"),
      },
      {
        language: "java",
        label: "Java (JDK 17)",
        signature: "static int[] solve(int[] nums, int target)",
        starterCode: [
          "static int[] solve(int[] nums, int target) {",
          "    // your code here",
          "    return new int[]{0, 0};",
          "}",
        ].join("\n"),
      },
    ],
    examples: [
      { args: [[2, 7, 11, 15], 9], expected: [0, 1] },
      { args: [[3, 2, 4], 6], expected: [1, 2] },
    ],
    testCases: [
      { args: [[2, 7, 11, 15], 9], expected: [0, 1] },
      { args: [[3, 2, 4], 6], expected: [1, 2] },
      { args: [[3, 3], 6], expected: [0, 1] },
      { args: [[1, 5, 3, 8], 11], expected: [2, 3] },
      { args: [[-1, -2, -3, -4, -5], -8], expected: [2, 4] },
    ],
    points: 12,
  },
];

const SQL_QUESTIONS: SqlQuestion[] = [
  {
    kind: "sql",
    id: "sql-1",
    title: "Top 3 highest-paid employees",
    schema:
      "employees(id INT, name TEXT, department TEXT, salary INT)",
    prompt:
      "Write a SQL query that returns the name and salary of the 3 highest-paid employees, ordered from highest to lowest salary.",
    sampleData: [
      {
        name: "employees",
        columns: [
          { name: "id", type: "INT" },
          { name: "name", type: "TEXT" },
          { name: "department", type: "TEXT" },
          { name: "salary", type: "INT" },
        ],
        rows: [
          [1, "Alice", "Engineering", 120000],
          [2, "Bob", "Sales", 95000],
          [3, "Carol", "Engineering", 110000],
          [4, "Dan", "Marketing", 80000],
          [5, "Eve", "Engineering", 130000],
          [6, "Frank", "Sales", 90000],
          [7, "Grace", "Engineering", 115000],
          [8, "Heidi", "Engineering", 105000],
        ],
      },
    ],
    points: 8,
  },
  {
    kind: "sql",
    id: "sql-2",
    title: "Departments with more than 5 employees",
    schema:
      "employees(id INT, name TEXT, department TEXT, salary INT)",
    prompt:
      "Write a SQL query that returns each department that has more than 5 employees, along with the number of employees in that department.",
    sampleData: [
      {
        name: "employees",
        columns: [
          { name: "id", type: "INT" },
          { name: "name", type: "TEXT" },
          { name: "department", type: "TEXT" },
          { name: "salary", type: "INT" },
        ],
        rows: [
          [1, "Alice", "Engineering", 90000],
          [2, "Bob", "Engineering", 92000],
          [3, "Carol", "Engineering", 95000],
          [4, "Dan", "Engineering", 88000],
          [5, "Eve", "Engineering", 99000],
          [6, "Frank", "Engineering", 91000],
          [7, "Grace", "Sales", 70000],
          [8, "Heidi", "Sales", 72000],
          [9, "Ivan", "Sales", 71000],
          [10, "Judy", "Support", 60000],
          [11, "Karl", "Support", 61000],
        ],
      },
    ],
    points: 8,
  },
  {
    kind: "sql",
    id: "sql-3",
    title: "Customer order totals",
    schema:
      "customers(id INT, name TEXT)\norders(id INT, customer_id INT, amount NUMERIC)",
    prompt:
      "Write a SQL query that lists every customer's name together with the SUM of their order amounts. Customers with no orders should appear with a total of 0.",
    sampleData: [
      {
        name: "customers",
        columns: [
          { name: "id", type: "INT" },
          { name: "name", type: "TEXT" },
        ],
        rows: [
          [1, "Acme"],
          [2, "Globex"],
          [3, "Initech"],
          [4, "Umbrella"],
        ],
      },
      {
        name: "orders",
        columns: [
          { name: "id", type: "INT" },
          { name: "customer_id", type: "INT" },
          { name: "amount", type: "NUMERIC" },
        ],
        rows: [
          [1, 1, 100.5],
          [2, 1, 250],
          [3, 1, 75],
          [4, 2, 50],
        ],
      },
    ],
    points: 8,
  },
];

export const ALL_QUESTIONS: Question[] = [
  ...MCQ_QUESTIONS,
  ...CODING_QUESTIONS,
  ...SQL_QUESTIONS,
];

export function getMcqQuestions(): McqQuestion[] {
  return MCQ_QUESTIONS.map((q) => ({ ...q }));
}

export function getCodingQuestions(): CodingQuestion[] {
  return CODING_QUESTIONS.map((q) => ({ ...q }));
}

export function getSqlQuestions(): SqlQuestion[] {
  return SQL_QUESTIONS.map((q) => ({ ...q }));
}

// Shuffle helper (Fisher–Yates)
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildQuestionSet(): {
  mcq: McqQuestion[];
  coding: CodingQuestion[];
  sql: SqlQuestion[];
} {
  return {
    mcq: shuffle(MCQ_QUESTIONS),
    coding: CODING_QUESTIONS.map((q) => ({ ...q })),
    sql: SQL_QUESTIONS.map((q) => ({ ...q })),
  };
}
