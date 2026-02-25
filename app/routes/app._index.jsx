import { authenticate } from "../shopify.server";
import { useLoaderData } from "react-router";
export const loader = async ({ request }) => {
  // 1. authenticate.admin theke 'admin' object-ti nite hobe
  const { admin } = await authenticate.admin(request);

  // 2. admin.graphql use korte hobe query korar jonno
  const response = await admin.graphql(`
    #graphql
    query getProducts {
      products(first: 50) {
        edges {
          node {
            id
            title

            images(first: 1) {
            edges {
              node {
                url
                altText
              }
            }
          }


          }
        }
      }
    }
  `);

  // 3. Response theke data convert korte hobe
  const responseJson = await response.json();
  const products = responseJson.data.products.edges;

  // 4. Data return korte hobe (Remix/Shopify convention)
  return { products };
};

export default function Index() {

  const { products } = useLoaderData();


  return (
<s-page heading="Print Labs">

    



      <s-section accessibilityLabel="Empty state section">
        <s-grid gap="base" justifyItems="center" paddingBlock="medium">
          <s-box maxInlineSize="150px" maxBlockSize="200px">
       
            <s-image
              aspectRatio="1/0.5"
              src="https://cdn.shopify.com/s/files/1/0733/2796/8301/files/Adobe_Express_-_file_1.jpg?v=1769962481"
              alt="A stylized graphic of four characters, each holding a puzzle piece"
            />
          </s-box>
          <s-grid justifyItems="center" maxInlineSize="450px" gap="base" paddingBlock="large-50">
            <s-stack alignItems="center">
              <s-heading>Create Multy Custom Variant How much you want </s-heading>
            
            </s-stack>
      
          </s-grid>
        </s-grid>
      </s-section>

 
      <s-section padding="none" accessibilityLabel="Puzzles table section">
        <s-table>
          <s-table-header-row>
            <s-table-header listSlot="primary">Product</s-table-header>
         
            <s-table-header>Status</s-table-header>
          </s-table-header-row>

          
          <s-table-body>

          {products.map((product, index) => {
      return (
         <s-table-row key={index}>
              <s-table-cell>
                <s-stack direction="inline" gap="small" alignItems="center">
                  <s-clickable
                    href="/app/details"
                    accessibilityLabel="Mountain View puzzle thumbnail"
                    border="base"
                    borderRadius="base"
                    overflow="hidden"
                    inlineSize="40px"
                    blockSize="40px"
                  >
                    <s-image
                      objectFit="cover"
                      alt={product.node.images.edges[0]?.node.altText || "Product image"}
                      src={product.node.images.edges[0]?.node.url || ""}
                     />
                  </s-clickable>
                  <s-link href={`/app/details/${product.node.id.split('/').pop()}`}>{product.node.title}</s-link>
                </s-stack>
              </s-table-cell>
        
              <s-table-cell>
                <s-badge color="base" tone="success">
                  Active
                </s-badge>
              </s-table-cell>
            </s-table-row>
      );
    })}


          </s-table-body>
      </s-table>
    </s-section>


   <s-button-group>
 
 
   <s-button slot="secondary-actions">previous </s-button>
    <s-button slot="primary-action">Next </s-button>
</s-button-group>



</s-page>
  );
}


