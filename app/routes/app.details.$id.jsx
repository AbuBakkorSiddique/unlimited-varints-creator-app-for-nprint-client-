import { useLoaderData, Form, useActionData } from "react-router";
import { authenticate } from "../shopify.server";
import { useState } from "react";

/* ================= LOADER ================= */

export const loader = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);
  const productId = `gid://shopify/Product/${params.id}`;

  const response = await admin.graphql(
    `#graphql
    query getProduct($id: ID!) {
      product(id: $id) {
        title
        images(first:1){
          edges{
            node{
              url
              altText
            }
          }
        }
        metafield(namespace: "custom", key: "custom_variants") {
          value
        }
      }
    }
    `,
    { variables: { id: productId } }
  );

  const json = await response.json();
  const product = json?.data?.product;

  return {
    product,
    existingVariants: product?.metafield?.value
      ? JSON.parse(product.metafield.value)
      : null,
  };
};

/* ================= ACTION ================= */

export const action = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const variantData = formData.get("variantData");
  const productId = `gid://shopify/Product/${params.id}`;

  const response = await admin.graphql(
    `#graphql
    mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
        }
        userErrors {
          field
          message
        }
      }
    }
    `,
    {
      variables: {
        metafields: [
          {
            ownerId: productId,
            namespace: "custom",
            key: "custom_variants",
            type: "json",
            value: variantData,
          },
        ],
      },
    }
  );

  const json = await response.json();

  return {
    success:
      json?.data?.metafieldsSet?.userErrors?.length === 0,
    errors:
      json?.data?.metafieldsSet?.userErrors || [],
  };
};

/* ================= COMPONENT ================= */

export default function Details() {
  const { product, existingVariants } = useLoaderData();
  const actionData = useActionData();

  const [variants, setVariants] = useState(
    existingVariants || [
      {
        variantTitle: "",
        options: [{ label: "", value: "" }],
      },
    ]
  );

  /* ===== Variant Functions ===== */

  const addVariant = () => {
    setVariants([
      ...variants,
      {
        variantTitle: "",
        options: [{ label: "", value: "" }],
      },
    ]);
  };

  const deleteVariant = (index) => {
    const updated = variants.filter((_, i) => i !== index);
    setVariants(updated);
  };

  const handleVariantTitleChange = (index, value) => {
    const updated = [...variants];
    updated[index].variantTitle = value;
    setVariants(updated);
  };

  /* ===== Option Functions ===== */

  const addOption = (variantIndex) => {
    const updated = [...variants];
    updated[variantIndex].options.push({ label: "", value: "" });
    setVariants(updated);
  };

  const deleteOption = (variantIndex, optionIndex) => {
    const updated = [...variants];
    updated[variantIndex].options =
      updated[variantIndex].options.filter(
        (_, i) => i !== optionIndex
      );
    setVariants(updated);
  };

  const handleOptionChange = (
    variantIndex,
    optionIndex,
    field,
    value
  ) => {
    const updated = [...variants];
    updated[variantIndex].options[optionIndex][field] = value;
    setVariants(updated);
  };

  return (
    <s-page heading="Product Custom Variant Builder">

      {/* Product Info */}
      <s-section>
        <s-grid gap="base" justifyItems="center">
          <s-thumbnail
            alt={
              product?.images?.edges[0]?.node?.altText ||
              "Product Image"
            }
            src={
              product?.images?.edges[0]?.node?.url || ""
            }
          />
          <s-heading>{product?.title}</s-heading>
        </s-grid>
      </s-section>

      {/* Success / Error */}
      <s-section>
        {actionData?.success && (
          <s-text tone="success">
            ✅ Variants Saved Successfully
          </s-text>
        )}

        {actionData?.errors?.length > 0 && (
          <s-text tone="critical">
            {actionData.errors[0].message}
          </s-text>
        )}
      </s-section>

      {/* <s-section>
     {JSON.stringify(variants)}
      </s-section> */}

      {/* Variant Builder */}
      <s-section>
        <Form method="POST">

          {variants.map((variant, vIndex) => (
            <s-box key={vIndex} padding="base" border="base">

              {/* Variant Title */}
              <s-grid gridTemplateColumns="1fr auto" gap="small">
                <s-text-field
                  label="Variant Title"
                  value={variant.variantTitle}
                  onChange={(e) =>
                    handleVariantTitleChange(
                      vIndex,
                      e.target.value
                    )
                  }
                />

                <s-button
                  type="button"
                  tone="critical"
                  onClick={() => deleteVariant(vIndex)}
                >
                  Delete Variant
                </s-button>
              </s-grid>

              {/* Options */}
              {variant.options.map((option, oIndex) => (
                <s-grid
                  key={oIndex}
                  gridTemplateColumns="1fr 1fr auto"
                  gap="small"
                  paddingBlock="small"
                >
                  <s-text-field
                    label="Label"
                    value={option.label}
                    onChange={(e) =>
                      handleOptionChange(
                        vIndex,
                        oIndex,
                        "label",
                        e.target.value
                      )
                    }
                  />

                  <s-text-field
                    label="Value"
                    value={option.value}
                    onChange={(e) =>
                      handleOptionChange(
                        vIndex,
                        oIndex,
                        "value",
                        e.target.value
                      )
                    }
                  />

                  <s-button
                    type="button"
                    tone="critical"
                    onClick={() =>
                      deleteOption(vIndex, oIndex)
                    }
                  >
                    Delete
                  </s-button>
                </s-grid>
              ))}

              <s-button
                type="button"
                onClick={() => addOption(vIndex)}
              >
                + Add Label & Value
              </s-button>

            </s-box>
          ))}

          {/* Add Variant */}
          <s-box paddingBlock="medium">
            <s-button
              type="button"
              onClick={addVariant}
            >
              + Add Variant
            </s-button>
          </s-box>

          {/* Hidden JSON */}
          <input
            type="hidden"
            name="variantData"
            value={JSON.stringify(variants)}
          />

          {/* Save */}
          <s-button type="submit">
            Save All Variants
          </s-button>

        </Form>
      </s-section>

    </s-page>
  );
}
