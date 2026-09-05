import type { ExampleService } from "../services";
export const autoServices: readonly ExampleService[] = [
  {
    slug: "mot-and-servicing",
    title: "MOT and servicing in Kent",
    description:
      "Plan the checks and maintenance your vehicle needs, with the scope made clear before booking.",
    question: "Is an MOT the same as a service?",
    answer:
      "No. An MOT and a service serve different purposes. Discuss the vehicle’s history and manufacturer’s maintenance schedule with the workshop so the proposed appointment covers what you need.",
    steps: [
      [
        "Tell us about the vehicle",
        "Have the registration, mileage and recent service history ready for the workshop.",
      ],
      [
        "Confirm the appointment scope",
        "Ask which checks and service items are included, and how additional findings will be handled.",
      ],
      [
        "Agree the practicalities",
        "Discuss drop-off, collection and how the workshop will contact you before extra work.",
      ],
    ],
    preparation: [
      "Vehicle registration and approximate mileage",
      "Recent service information",
      "Any warning lights or changes you’ve noticed",
    ],
  },
  {
    slug: "vehicle-diagnostics",
    title: "Vehicle diagnostics and warning lights",
    description: "Find the cause of a change before choosing the repair.",
    question: "Does reading a fault code identify the repair?",
    answer:
      "A fault code is a starting point for investigation. The workshop may need to inspect and test the related system before explaining the cause and recommending a repair.",
    steps: [
      [
        "Describe the symptom",
        "Explain what happens, when it happens and whether it is getting worse.",
      ],
      [
        "Agree the investigation",
        "Understand the initial diagnostic scope and charge before testing begins.",
      ],
      [
        "Review the findings",
        "Ask for the explanation, repair options and costs before agreeing further work.",
      ],
    ],
    preparation: [
      "A description of the warning or symptom",
      "When it started and how often it happens",
      "Recent repairs or changes to the vehicle",
    ],
  },
  {
    slug: "brakes-and-repairs",
    title: "Brakes, wear and vehicle repairs",
    description:
      "A clear conversation about the components that help your car feel right on the road.",
    question: "What if the car feels unsafe to drive?",
    answer:
      "Do not continue driving a vehicle you believe is unsafe. Contact an appropriate professional or recovery service to discuss the safest way to have it inspected.",
    steps: [
      [
        "Explain the change",
        "Describe noises, vibration or a change in braking or handling.",
      ],
      [
        "Inspect before replacing",
        "Agree an assessment so the proposed work is based on the condition found.",
      ],
      [
        "Make an informed decision",
        "Understand the parts, labour and any related work before authorising the repair.",
      ],
    ],
    preparation: [
      "The symptoms you have noticed",
      "Whether the car is currently driveable",
      "Any relevant repair history",
    ],
  },
];
