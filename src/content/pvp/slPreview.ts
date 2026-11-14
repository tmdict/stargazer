/* The example set on the guide index's card for the PvP team generator: a set
 * the generator gave, kept here so the index loads neither the data file nor
 * the generator and the build does not run it.
 *
 * `data` is a 5v5 team code and carries its season, so after a season cutover
 * its seasonal artifacts and phantimals draw as retired until the example is
 * replaced. */

import type { SlChoiceTeam } from '@/lib/pvp/generator/types'

export const SL_PREVIEW: {
  data: string
  teams: (Pick<SlChoiceTeam, 'core' | 'flex' | 'pairs'> & {
    // The map's place in the Supreme League list.
    map: number
  })[]
} = {
  data: 'eyJib2FyZHMiOlt7InQiOltbNDMsMl0sWzQ1LDJdLFszOCwyXSxbNDAsMl0sWzQyLDJdLFs0NCwyXSxbMzQsMl0sWzM3LDJdLFszOSwyXSxbNDEsMl0sWzMwLDJdLFszMywyXSxbMzYsMl0sWzEwLDNdLFsxMywzXSxbMTYsM10sWzUsM10sWzcsMV0sWzksM10sWzEyLDFdLFsyLDFdLFs0LDNdLFs2LDFdLFs4LDNdLFsxLDFdLFszLDFdXSwiYyI6W1sxNiwxMDYsMV0sWzUsMTExLDFdLFs5LDEwOSwxXSxbNCw4MCwxXSxbOCw1MiwxXV0sInMiOltbMTMsNSwxXSxbMTAsMTAwMDUsMV1dLCJ1IjpbWzEsNTIsMSw0XSxbMSw1MiwyLDRdLFsxLDgwLDEsNF0sWzEsODAsMiw0XSxbMSwxMDYsMSw0XSxbMSwxMDYsMiw0XSxbMSwxMDksMSw0XSxbMSwxMDksMiw0XSxbMSwxMTEsMSw0XSxbMSwxMTEsMiw0XV0sImEiOls3LG51bGxdLCJtIjoiYXJlbmExIn0seyJ0IjpbWzQzLDJdLFs0NSwyXSxbMzUsNV0sWzM4LDJdLFs0MCwyXSxbNDIsMl0sWzQ0LDJdLFszMSw1XSxbMzQsNV0sWzM3LDVdLFszOSwyXSxbNDEsMl0sWzMzLDJdLFszNiwyXSxbMTAsM10sWzEzLDNdLFs1LDNdLFs3LDNdLFs5LDVdLFsxMiw1XSxbMTUsNV0sWzIsMV0sWzQsM10sWzYsM10sWzgsMV0sWzExLDVdLFsxLDFdLFszLDFdXSwiYyI6W1sxMyw1NywxXSxbNSwzNSwxXSxbNyw4OCwxXSxbNCwxMzEsMV0sWzYsMTEwLDFdXSwicyI6W1sxMCwzLDFdXSwidSI6W1sxLDM1LDEsNF0sWzEsMzUsMiw0XSxbMSw1NywxLDRdLFsxLDU3LDIsNF0sWzEsODgsMSw0XSxbMSw4OCwyLDRdLFsxLDExMCwxLDRdLFsxLDExMCwyLDRdLFsxLDEzMSwxLDRdLFsxLDEzMSwyLDRdXSwiYSI6WzE4LG51bGxdLCJtIjoiYXJlbmEyIn0seyJ0IjpbWzQ1LDJdLFs0MiwyXSxbNDQsMl0sWzMxLDVdLFszNCw1XSxbMzcsMl0sWzM5LDJdLFs0MSwyXSxbMjEsM10sWzI0LDVdLFszMCwyXSxbMzMsMl0sWzM2LDVdLFsxNCwzXSxbMTcsNV0sWzI5LDVdLFszMiwyXSxbMTAsNV0sWzEzLDNdLFsxNiwxXSxbMjIsNV0sWzI1LDJdLFs1LDNdLFs3LDFdLFs5LDFdLFsxMiw1XSxbMTUsNV0sWzIsMV0sWzQsMV0sWzEsM11dLCJjIjpbWzIxLDEwNywxXSxbMTQsMTI4LDFdLFsxMywxMDAsMV0sWzUsMTE3LDFdLFsxLDExMywxXV0sInUiOltbMSwxMDAsMSw0XSxbMSwxMDAsMiw0XSxbMSwxMDcsMSw0XSxbMSwxMDcsMiw0XSxbMSwxMTMsMSw0XSxbMSwxMTMsMiw0XSxbMSwxMTcsMSw0XSxbMSwxMTcsMiw0XSxbMSwxMjgsMSw0XSxbMSwxMjgsMiw0XV0sImEiOls4LG51bGxdLCJtIjoiYXJlbmEzIn0seyJ0IjpbWzQzLDJdLFs0NSwyXSxbMzUsNl0sWzM4LDZdLFs0MCw2XSxbNDIsNl0sWzQ0LDJdLFsyOCwyXSxbMzEsMl0sWzM0LDJdLFszNywyXSxbMzksMl0sWzQxLDJdLFs1LDNdLFs3LDNdLFs5LDFdLFsxMiwxXSxbMTUsM10sWzE4LDNdLFsyLDNdLFs0LDZdLFs2LDZdLFs4LDZdLFsxMSw2XSxbMSwxXSxbMywzXV0sImMiOltbNyw4NCwxXSxbMTUsMTQsMV0sWzE4LDg3LDFdLFsyLDEyNywxXSxbMyw5MCwxXV0sInMiOltbNSwyLDFdXSwidSI6W1sxLDE0LDEsNF0sWzEsMTQsMiw0XSxbMSw4NCwxLDRdLFsxLDg0LDIsNF0sWzEsODcsMSw0XSxbMSw4NywyLDRdLFsxLDkwLDEsNF0sWzEsOTAsMiw0XSxbMSwxMjcsMSw0XSxbMSwxMjcsMiw0XV0sImEiOlszLG51bGxdLCJtIjoicHJlc2V0LXNyMSJ9LHsidCI6W1s0NSwyXSxbMzUsMl0sWzM4LDJdLFs0MCwyXSxbNDIsMl0sWzQ0LDJdLFs0MSw2XSxbMjEsNl0sWzMwLDJdLFszNiw2XSxbMTQsM10sWzE3LDZdLFsyMCwxXSxbMjYsMl0sWzI5LDZdLFszMiwyXSxbMTAsNl0sWzE2LDNdLFsyNSw2XSxbNSw2XSxbMiwzXSxbNCwzXSxbNiwzXSxbOCwzXSxbMTEsM10sWzEsM11dLCJjIjpbWzE0LDEyMSwxXSxbMiw2OCwxXSxbNCw3NCwxXSxbNiwxMTYsMV0sWzgsMTAwNjgsMV0sWzExLDkxLDFdXSwicyI6W1sxLDUsMV0sWzE2LDEwMDA1LDFdXSwidSI6W1sxLDY4LDEsNF0sWzEsNjgsMiw0XSxbMSw3NCwxLDRdLFsxLDc0LDIsNF0sWzEsOTEsMSw0XSxbMSw5MSwyLDRdLFsxLDExNiwxLDRdLFsxLDExNiwyLDRdLFsxLDEyMSwxLDRdLFsxLDEyMSwyLDRdXSwiYSI6WzExLG51bGxdLCJtIjoicHJlc2V0LXNyMyJ9XSwibW9kZSI6IjV2NSIsInNlYXNvbiI6OH0',
  teams: [
    {
      map: 0,
      core: [109, 106, 111],
      flex: [
        { out: 80, options: [112] },
        { out: 52, options: [112, 104, 54] },
      ],
      pairs: [],
    },
    { map: 1, core: [131], flex: [], pairs: [] },
    { map: 2, core: [128, 113, 107, 100], flex: [{ out: 117, options: [28, 130, 69] }], pairs: [] },
    {
      map: 3,
      core: [14, 84, 127],
      flex: [
        { out: 87, options: [54, 94, 18] },
        { out: 90, options: [104] },
      ],
      pairs: [],
    },
    {
      map: 4,
      core: [68, 121],
      flex: [
        { out: 91, options: [73, 54, 70] },
        { out: 116, options: [130, 115, 82] },
      ],
      pairs: [],
    },
  ],
}
