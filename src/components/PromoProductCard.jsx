import ProductCard from './ProductCard.jsx'

export default function PromoProductCard(props) {
  return <ProductCard {...props} promotion storefrontContext="offers" />
}
