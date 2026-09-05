import type { ExampleService } from "../services";
export const equipmentServices: readonly ExampleService[] = [
  {
    slug: "vehicle-lift-planning",
    title: "Choosing a vehicle lift",
    description:
      "Put vehicle mix, working clearance and site suitability before the product shortlist.",
    question: "Is rated capacity enough to choose a vehicle lift?",
    answer:
      "Capacity is one factor. The intended vehicles, lifting arrangements, working clearance and manufacturer’s site requirements also affect suitability. Ask a competent supplier or installer to assess the site and explain the requirements for the specific model before making a commitment.",
    steps: [
      [
        "Describe the workload",
        "Explain the vehicle types and the jobs the lift needs to support.",
      ],
      [
        "Assess the site",
        "Arrange a review of dimensions, floor suitability, power and access against the manufacturer’s requirements.",
      ],
      [
        "Agree the complete scope",
        "Clarify delivery, installation, commissioning, user information and ongoing support in the quote.",
      ],
    ],
    preparation: [
      "Vehicle types and intended work",
      "Site dimensions and access information",
      "Available floor and electrical documentation",
    ],
  },
  {
    slug: "tyre-equipment-selection",
    title: "Selecting tyre and wheel equipment",
    description:
      "Compare equipment around wheel types, workload and the support you will need.",
    question: "How do we choose equipment for our tyre workload?",
    answer:
      "Describe the wheel and tyre types you expect to handle and how the work fits into the day. Ask the supplier to explain suitable options, accessories, training and site requirements. Compare the complete proposal, including installation and support, rather than machine price alone.",
    steps: [
      [
        "Define the job mix",
        "Explain typical wheel types, workload and the jobs you want to accommodate.",
      ],
      [
        "Check the practical requirements",
        "Discuss power, compressed air, clearance and the proposed operator workflow.",
      ],
      [
        "Compare the full proposal",
        "Confirm accessories, commissioning, training arrangements and ongoing service availability.",
      ],
    ],
    preparation: [
      "Typical wheel and tyre types",
      "Your existing equipment and workspace",
      "The work you want the new equipment to support",
    ],
  },
  {
    slug: "workshop-equipment-support",
    title: "Equipment installation and support",
    description:
      "Clarify site preparation, service enquiries and responsibility after installation.",
    question: "What should an equipment service enquiry include?",
    answer:
      "Provide the make and model, the symptoms observed and any relevant maintenance history. Avoid operating equipment you believe may be unsafe. A qualified service provider should advise on the next assessment and any precautions; an online enquiry does not establish that equipment is safe to use.",
    steps: [
      [
        "Describe the equipment",
        "Identify the make, model and the issue or planned installation.",
      ],
      [
        "Confirm the next assessment",
        "Discuss access, equipment status and what information the provider needs before a visit.",
      ],
      [
        "Agree the scope",
        "Ask for the proposed work, charges, limitations and any required follow-up to be explained.",
      ],
    ],
    preparation: [
      "Make and model of the equipment",
      "A description of the issue or installation need",
      "Site access and maintenance information",
    ],
  },
];
